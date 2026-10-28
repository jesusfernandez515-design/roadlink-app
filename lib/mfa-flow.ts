import { TotpMultiFactorGenerator, type MultiFactorResolver } from "firebase/auth";

export async function resolveTotpChallenge(resolver: MultiFactorResolver, factorId: string, code: string) {
  if (!/^\d{6}$/.test(code) || !resolver.hints.some(h => h.uid === factorId && h.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
    throw new Error("Selecciona tu autenticador e introduce un código de seis dígitos.");
  }
  return resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factorId, code));
}
