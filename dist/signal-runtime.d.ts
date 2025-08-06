declare class SignalRuntime {
    constructor(poolSize?: number);

    registerAction(objectName: string, actionId: number, handler: (contextFrame: object) => any): () => void;
    subscribe(actionId: number, fn: (contextFrame: object, error?: any) => void): () => void;
    dispatchSignal(actionName: string, object: any, payload: any): any;

    use(plugin: object): void;
    dispose(): void;

    onBefore(fn: (resultCode: number, stateCode: number, actionId: number, frame: object) => void): void;
    onAfter(fn: (error: any, contextFrame: object) => void): void;

    onSignal(signal: string | number, fn: (data: any) => void): () => void;
    emitSignal(signal: string | number, data: any): void;
    emitSignalWithMeta(signal: string | number, data: any, meta: any): void;

    getDiagnostics(verbose?: boolean): object;
    getSummary(): string;
}

declare class SafeSignalRuntime extends SignalRuntime {
    constructor(poolSize?: number);

    dispatchSignal(actionName: string, object: any, payload: any): {
        success: boolean;
        result?: any;
        error?: any;
    };
}

declare class SpliceAPI {
    constructor(protocol: SignalRuntime);

    dispatchSignal(actionName: string, object: any, payload: any): any;

    subscribe(actionKey: string | number, fn: (frame: object, error?: any) => void): Function | { status: string };

    onSignal(signal: string | number, fn: (data: any) => void): Function | { status: string };
    emitSignal(signal: string | number, data: any): any;
    emitSignalWithMeta(signal: string | number, data: any, meta: any): any;

    use(plugin: object): void;
    dispose(): void;

    getDiagnostics(verbose?: boolean): object;
    getSummary(): string;

    readonly metrics: object;
    readonly poolStats: object;
    readonly plugins: Map<string, object>;
    readonly handlers: object;

    getResultMeta(code: number): object | undefined;
    runResultHook(code: number, contextFrame?: object): void;
}
