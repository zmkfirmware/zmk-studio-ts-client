import type { RpcTransport } from './';

export async function connect(options?: SerialPortRequestOptions): Promise<RpcTransport> {
  let abortController = new AbortController();
  let port = await navigator.serial.requestPort(options);

  await port.open({ baudRate: 12500 })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "NetworkError") {
            throw new Error("Failed to open the serial port. Check the permissions of the device and verify it is not in use by another process.", { cause: e });
          } else {
            throw e;
          }
        });

  let info = port.getInfo();
  let label =
    (info.usbVendorId?.toLocaleString() || '') +
    ':' +
    (info.usbProductId?.toLocaleString() || '');

  
  let sig = abortController.signal;
  let abort_cb: (this: AbortSignal, ev: Event) => any;
  
  abort_cb = async (ev: Event) => {
    sig.removeEventListener("abort", abort_cb);
    await port.writable?.close();
    await port.readable?.cancel();

    await port.close();
  }

  sig.addEventListener("abort", abort_cb);

  return { label, abortController, readable: port.readable!, writable: port.writable! };
}
