import { ReadableStream, TransformStream } from 'web-streams-polyfill';
import { get_encoder, get_decoder } from '../src/framing';

describe('framing', () => {
  describe('get_encoder', () => {
    it('transforms a basic byte array with SOF and EOF', async () => {
      const input = Uint8Array.from([1, 2, 3]);

      const readable: ReadableStream = ReadableStream.from([input]);

      const converted = readable.pipeThrough(
        new TransformStream(get_encoder())
      );

      let reader = converted.getReader();
      let chunks = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks = chunks.concat(Array.from(value.values()));
        }
      } finally {
        reader.releaseLock();
      }

      expect(chunks).toEqual([171, 1, 2, 3, 173]);
    });

    it('transforms a complex byte array with SOF and EOF', async () => {
      const input = Uint8Array.from([1, 171, 172, 2, 3, 171, 4, 173, 5]);

      const readable: ReadableStream = ReadableStream.from([input]);

      const converted = readable.pipeThrough(
        new TransformStream(get_encoder())
      );

      let reader = converted.getReader();
      let chunks = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks = chunks.concat(Array.from(value.values()));
        }
      } finally {
        reader.releaseLock();
      }

      expect(chunks).toEqual([
        171, 1, 172, 171, 172, 172, 2, 3, 172, 171, 4, 172, 173, 5, 173,
      ]);
    });
  });

  describe('get_decoder', () => {
    it('transforms a basic byte array containing SOF and EOF', async () => {
      const input = Uint8Array.from([171, 1, 2, 3, 173, 171, 4, 173]);

      const readable: ReadableStream = ReadableStream.from([input]);

      const converted = readable.pipeThrough(
        new TransformStream(get_decoder())
      );

      let reader = converted.getReader();
      let { done: first_done, value: first_value } = await reader.read();

      expect(first_done).toBeFalsy();
      expect(first_value).toEqual(Uint8Array.from([1, 2, 3]));

      let { done: second_done, value: second_value } = await reader.read();

      expect(second_done).toBeFalsy();
      expect(second_value).toEqual(Uint8Array.from([4]));

      let { done: third_done } = await reader.read();

      expect(third_done).toBeTruthy();
    });

    it('transforms a complex byte array with SOF and EOF', async () => {
      const input = Uint8Array.from([
        171, 1, 172, 171, 172, 172, 2, 3, 172, 171, 4, 172, 173, 5, 173,
      ]);

      const readable: ReadableStream = ReadableStream.from(input);

      const converted = readable.pipeThrough(
        new TransformStream(get_decoder())
      );

      let reader = converted.getReader();
      let { done, value } = await reader.read();

      expect(done).toBeFalsy();

      expect(value).toEqual(Uint8Array.from([1, 171, 172, 2, 3, 171, 4, 173, 5]));

      reader.releaseLock();
    });
  });
});
