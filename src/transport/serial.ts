import type { RpcTransport } from './';

export async function connect(): Promise<RpcTransport> {
  let port = await navigator.serial.requestPort({});

  await port.open({ baudRate: 12500 });

  let info = port.getInfo();
  let label =
    (info.usbVendorId?.toLocaleString() || '') +
    ':' +
    (info.usbProductId?.toLocaleString() || '');

  return { label, readable: port.readable!, writable: port.writable! };
}
