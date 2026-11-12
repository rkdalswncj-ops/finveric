declare module 'circomlibjs' {
  export function buildPoseidon(): Promise<((inputs: (bigint | string | number)[]) => Uint8Array) & { F: { toObject(value: Uint8Array): bigint } }>;
}
declare module 'snarkjs' {
  export const groth16: {
    fullProve(input: object, wasm: string, zkey: string, logger?: unknown, witnessOptions?: object, proverOptions?: object): Promise<{proof: any; publicSignals: string[]}>;
    verify(vkey: object, signals: string[], proof: object): Promise<boolean>;
    exportSolidityCallData(proof: object, signals: string[]): Promise<string>;
  };
}
