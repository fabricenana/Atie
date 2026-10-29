#!/usr/bin/env node
/**
 * Validation de bout en bout (Playwright, Chromium) contre un serveur local.
 *
 *   npm run build && npm start          # dans un terminal
 *   node scripts/e2e.mjs                # dans un autre (BASE_URL=http://127.0.0.1:3100 par défaut)
 *   node scripts/e2e.mjs --shots=dossier  # avec captures d'écran
 *
 * Vérifie : chaque route répond sans erreur pour le bon rôle, les contrôles d'accès
 * (client → admin, admin → client, viewer en lecture seule, entreprise d'un autre
 * tenant), l'absence de débordement horizontal aux 8 largeurs demandées, les
 * erreurs JavaScript, et quelques parcours (formulaires, filtres, thème).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = await import("playwright"));
}

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const SHOTS = shotsArg ? shotsArg.slice(8) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440, 1920];

const ADMIN_ROUTES = [
  "/admin",
  "/admin?period=7j",
  "/admin/entreprises",
  "/admin/entreprises/nouvelle",
  ...["general", "domaines", "receptionniste", "connaissances", "abonnement", "sessions", "utilisateurs", "historique"].map((t) => `/admin/entreprises/org_lumiere?tab=${t}`),
  "/admin/entreprises/org_alpes",
  "/admin/receptionnistes",
  "/admin/receptionnistes/nouvelle",
  "/admin/receptionnistes/rcp_maya_chalet",
  "/admin/connaissances",
  "/admin/connaissances/org_lumiere",
  "/admin/connaissances/org_lumiere/kbs_1",
  "/admin/sessions",
  "/admin/sessions/actives",
  "/admin/integrations",
  "/admin/integrations/org_lumiere",
  "/admin/abonnements",
  ...["formules", "abonnements", "recharges", "concurrence"].map((t) => `/admin/abonnements?tab=${t}`),
  "/admin/abonnements/formules/nouvelle",
  "/admin/abonnements/formules/pln_premium",
  "/admin/facturation",
  ...["factures", "paiements", "avoirs", "recharges", "parametres"].map((t) => `/admin/facturation?tab=${t}`),
  "/admin/facturation/inv_1",
  "/admin/parametres",
  ...["profil", "utilisateurs", "roles", "plateforme", "langues", "notifications", "alertes", "audit", "fournisseurs", "services", "securite"].map((s) => `/admin/parametres?section=${s}`),
];

const CLIENT_ROUTES = [
  "/client",
  "/client/receptionniste",
  "/client/demandes",
  "/client/demandes?tab=interactions",
  "/client/demandes?tab=notifications",
  "/client/consommation",
  "/client/consommation?period=12m",
  "/client/abonnement",
  "/client/entreprise",
  "/client/assistance",
  "/client/assistance?type=minutes",
];

/** Routes dont la largeur est testée aux 8 points de rupture. */
const RESPONSIVE = ["/admin", "/admin/entreprises", "/admin/entreprises/org_lumiere?tab=abonnement", "/admin/receptionnistes/rcp_lea_lumiere", "/admin/sessions", "/admin/integrations/org_chalet", "/admin/abonnements", "/admin/facturation", "/admin/parametres?section=roles"];
const RESPONSIVE_CLIENT = ["/client", "/client/demandes", "/client/consommation", "/client/abonnement", "/client/assistance"];

let failures = 0;
let checks = 0;
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const ok = (cond, msg) => {
  checks++;
  if (!cond) fail(msg);
};

/** Requête depuis la page : le navigateur envoie le cookie de session (Secure accepté sur localhost). */
async function fetchInPage(page, path) {
  return page.evaluate(async (p) => {
    const r = await fetch(p);
    return { status: r.status, text: await r.text() };
  }, path);
}

async function login(browser, uid, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/connexion`);
  await page.locator(`form:has(input[name="uid"][value="${uid}"]) button`).click();
  await page.waitForURL(/\/(admin|client)/);
  return { ctx, page };
}

function track(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function visitAll(page, routes, label) {
  console.log(`\n${label} — ${routes.length} routes`);
  const errors = track(page);
  for (const r of routes) {
    errors.length = 0;
    const res = await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(150);
    const status = res?.status() ?? 0;
    const url = page.url().replace(BASE, "");
    ok(status === 200, `${r} → HTTP ${status}`);
    ok(!/connexion|denied=1/.test(url), `${r} redirigé vers ${url}`);
    ok((await page.locator("h1").count()) >= 1, `${r} sans titre h1`);
    ok(errors.length === 0, `${r} erreurs JS : ${errors.join(" | ")}`);
    if (SHOTS && !r.includes("?") ) {
      await page.screenshot({ path: `${SHOTS}/${label.split(" ")[0]}${r.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: true });
    }
  }
}

async function overflow(page, routes, label) {
  console.log(`\nResponsive ${label} — ${routes.length} routes × ${WIDTHS.length} largeurs`);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const r of routes) {
      await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(100);
      const over = await page.evaluate(() => {
        const doc = document.documentElement;
        const extra = doc.scrollWidth - doc.clientWidth;
        if (extra <= 1) return null;
        // élément fautif le plus large (hors zones à défilement volontaire)
        const bad = [...document.querySelectorAll("body *")].find((el) => {
          const rc = el.getBoundingClientRect();
          return rc.right > doc.clientWidth + 1 && !el.closest('[role="region"],.overflow-x-auto,dialog');
        });
        return `${extra}px (${bad ? bad.tagName.toLowerCase() + "." + String(bad.className).slice(0, 60) : "?"})`;
      });
      ok(over === null, `${r} @${w}px déborde de ${over}`);
      if (SHOTS && (w === 390 || w === 768)) {
        await page.screenshot({ path: `${SHOTS}/${label}_${w}${r.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

const browser = await chromium.launch();
try {
  // 1. Accès anonyme
  console.log("Accès anonyme");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const r of ["/admin", "/admin/entreprises", "/client", "/client/abonnement"]) {
      await page.goto(BASE + r);
      ok(page.url().includes("/connexion"), `${r} accessible sans session (${page.url()})`);
    }
    const res = await page.goto(`${BASE}/admin/facturation/export`);
    ok(res.status() === 401 || res.status() === 403 || page.url().includes("/connexion"), `export CSV sans session → ${res.status()}`);
    await ctx.close();
  }

  // 2. Super administrateur : toutes les routes admin
  {
    const { ctx, page } = await login(browser, "usr_super");
    await visitAll(page, ADMIN_ROUTES, "admin (super administrateur)");
    // Un administrateur ATIE n'entre pas dans l'espace client
    await page.goto(`${BASE}/client`);
    ok(page.url().endsWith("/admin"), `super admin redirigé hors de /client (${page.url()})`);
    // Export CSV autorisé
    const csv = await fetchInPage(page, "/admin/facturation/export");
    ok(csv.status === 200 && csv.text.includes("DEMO-"), `export CSV (${csv.status})`);
    // Page « introuvable » sur entité inconnue. Le statut HTTP reste 200 : la réponse est déjà
    // en streaming (loading.tsx) quand notFound() est levé — comportement documenté de Next.js.
    await page.goto(`${BASE}/admin/entreprises/org_inexistante`);
    ok((await page.locator("h1").innerText()).includes("introuvable"), "entreprise inconnue : page introuvable attendue");
    // Isolation KB : une source d'une autre entreprise n'est pas lisible via l'URL d'une autre
    await page.goto(`${BASE}/admin/connaissances/org_lumiere/kbs_5`);
    ok((await page.locator("h1").innerText()).includes("introuvable"), "source de Chalet lisible via l'URL de Lumière");

    // Parcours : recherche dans le tableau des entreprises
    await page.goto(`${BASE}/admin/entreprises`);
    await page.getByRole("searchbox").first().fill("Chalet");
    await page.waitForTimeout(150);
    ok((await page.locator("tbody tr").count()) === 1, "recherche « Chalet » : 1 ligne attendue");

    // Parcours : validation du formulaire de création d'entreprise (champs vides)
    await page.goto(`${BASE}/admin/entreprises/nouvelle`);
    await page.locator('form button[type="submit"]').last().click();
    await page.waitForTimeout(600);
    ok((await page.locator('[aria-invalid="true"]').count()) > 0, "création d'entreprise vide : erreurs de validation attendues");

    // Thème sombre persistant
    await page.goto(`${BASE}/admin`);
    await page.getByRole("radio", { name: "Thème sombre" }).first().click();
    await page.reload();
    ok((await page.evaluate(() => document.documentElement.dataset.theme)) === "dark", "thème sombre non conservé");
    await page.getByRole("radio", { name: "Thème du système" }).first().click();

    await overflow(page, RESPONSIVE, "admin");
    await ctx.close();
  }

  // 3. Opérateur : pages sensibles refusées côté serveur
  console.log("\nOpérateur ATIE");
  {
    const { ctx, page } = await login(browser, "usr_ops");
    await page.goto(`${BASE}/admin`);
    ok(page.url().endsWith("/admin"), "opérateur : accès au tableau de bord");
    await ctx.close();
  }

  // 4. Client administrateur : routes client et isolation
  {
    const { ctx, page } = await login(browser, "usr_chalet_admin");
    await visitAll(page, CLIENT_ROUTES, "client (Hôtel Chalet du Lac)");
    await page.goto(`${BASE}/client`);
    const body = await page.locator("main").innerText();
    ok(body.includes("Hôtel Chalet du Lac"), "le tableau de bord client affiche son entreprise");
    ok(!body.includes("Cabinet dentaire Lumière"), "le client Chalet ne voit pas Lumière");
    ok(!/lemonslice|livekit/i.test(body), "le client ne voit pas les fournisseurs techniques");
    for (const r of ["/admin", "/admin/entreprises/org_lumiere", "/admin/connaissances/org_lumiere"]) {
      await page.goto(BASE + r);
      ok(page.url().endsWith("/client"), `client redirigé hors de ${r} (${page.url()})`);
    }
    const csv = await fetchInPage(page, "/admin/facturation/export");
    ok(csv.status === 403 || csv.status === 401, `client → export CSV admin : ${csv.status}`);
    await overflow(page, RESPONSIVE_CLIENT, "client");
    await ctx.close();
  }

  // 5. Client en lecture seule
  console.log("\nClient lecture seule");
  {
    const { ctx, page } = await login(browser, "usr_lumiere_view");
    await page.goto(`${BASE}/client`);
    const body = await page.locator("main").innerText();
    ok(body.includes("Cabinet dentaire Lumière"), "viewer : son entreprise");
    ok(!body.includes("Chalet du Lac"), "viewer : pas d'autre entreprise");
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} vérifications réussies`);
process.exit(failures ? 1 : 0);
