export interface RpcTransport {
  label: string;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

export * as Gatt from './gatt';
