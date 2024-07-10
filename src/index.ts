import { Request, Response, RequestResponse, Notification } from './studio';

import { get_encoder, get_decoder } from './framing';
import { RpcTransport } from './transport';

import { Mutex } from 'async-mutex';
import { ErrorConditions } from './meta';
export { Request, RequestResponse, Response, Notification };

export interface RpcConnection {
  label: string;
  request_response_readable: ReadableStream<RequestResponse>;
  request_writable: WritableStream<Request>;
  notification_readable: ReadableStream<Notification>;
  current_request: number;
}

export function create_rpc_connection(transport: RpcTransport): RpcConnection {
  let { writable: request_writable, readable: byte_readable } =
    new TransformStream<Request, Uint8Array>({
      transform(chunk, controller) {
        let bytes = Request.encode(chunk).finish();
        controller.enqueue(bytes);
      },
    });

  byte_readable
    .pipeThrough(new TransformStream(get_encoder()))
    .pipeTo(transport.writable);

  let response_readable = transport.readable
    .pipeThrough(new TransformStream(get_decoder()))
    .pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(Response.decode(chunk));
        },
      })
    );

  let [a, b] = response_readable.tee();

  let request_response_readable = a.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (chunk.requestResponse) {
          controller.enqueue(chunk.requestResponse);
        }
      },
    })
  );

  let notification_readable = b.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (chunk.notification) {
          controller.enqueue(chunk.notification);
        }
      },
    })
  );

  return {
    label: transport.label,
    request_response_readable,
    request_writable,
    notification_readable,
    current_request: 0,
  };
}

const rpcMutex = new Mutex();

export class NoResponseError extends Error {
  constructor() {
    super("No RPC response received");
    Object.setPrototypeOf(this, NoResponseError.prototype);
  }
}

export class MetaError extends Error {
  readonly condition: ErrorConditions;

  constructor(condition: ErrorConditions) {
    super("Meta error: " + condition);
    this.condition = condition;
    Object.setPrototypeOf(this, MetaError.prototype);
  }
}

export async function call_rpc(
  conn: RpcConnection,
  req: Omit<Request, 'requestId'>
): Promise<RequestResponse> {
  return await rpcMutex.runExclusive(async () => {
    let request: Request = { ...req, requestId: conn.current_request++ };

    let writer = conn.request_writable.getWriter();
    await writer.write(request);
    writer.releaseLock();

    let reader = conn.request_response_readable.getReader();

    let { done, value } = await reader.read();
    reader.releaseLock();

    if (done || !value) {
      throw 'No response';
    }

    if (value.requestId != request.requestId) {
      throw 'Mismatch request IDs';
    }

    if (value.meta?.noResponse) {
      throw new NoResponseError();
    } else if (value.meta?.simpleError) {
      throw new MetaError(value.meta.simpleError);
    }

    return value;
  });
}
