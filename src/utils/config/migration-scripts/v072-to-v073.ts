/**
 * Migration script from v072 to v073
 * - Adds immersiveReading.enabledPatterns.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    immersiveReading: {
      ...oldConfig?.immersiveReading,
      enabledPatterns: oldConfig?.immersiveReading?.enabledPatterns ?? [],
    },
  }
}
