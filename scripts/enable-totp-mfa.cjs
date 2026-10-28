// Run only by the project administrator with the existing isolated test credential.
// Never print or commit that credential. This script does not enroll any account.
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
async function main() {
  const raw = process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta la credencial del proyecto de pruebas en el entorno seguro.");
  const account = JSON.parse(raw);
  if (account.project_id !== "roadlink-pruebas") throw new Error("Este script solo admite roadlink-pruebas.");
  const auth = getAuth(initializeApp({ credential: cert(account), projectId: account.project_id }));
  const current = await auth.projectConfigManager().getProjectConfig();
  const previous = current.multiFactorConfig?.providerConfigs || [];
  const providers = previous.filter(p => !p.totpProviderConfig);
  await auth.projectConfigManager().updateProjectConfig({ multiFactorConfig: {
    ...current.multiFactorConfig, state: "ENABLED", providerConfigs: [...providers, { state: "ENABLED", totpProviderConfig: { adjacentIntervals: 1 } }],
  } });
  const verified = await auth.projectConfigManager().getProjectConfig();
  if (verified.multiFactorConfig?.state !== "ENABLED" || !verified.multiFactorConfig?.providerConfigs?.some(p => p.state === "ENABLED" && p.totpProviderConfig)) throw new Error("No se pudo verificar TOTP.");
  process.stdout.write("TOTP habilitado en roadlink-pruebas. No se inscribió ninguna cuenta.\n");
}
main().catch(() => { process.stderr.write("No se pudo habilitar TOTP. Un administrador debe revisar Identity Platform y los permisos del proyecto de pruebas.\n"); process.exitCode = 1; });
