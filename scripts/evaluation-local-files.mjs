import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  lstatSync,
} from "node:fs";
export function readLocal(path, limit) {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  );
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > limit)
      throw Error("Expected regular file within byte budget");
    let size = 0;
    const chunks = [];
    for (;;) {
      const b = Buffer.alloc(Math.min(65536, limit - size + 1));
      const n = readSync(fd, b, 0, b.length, null);
      if (!n) break;
      size += n;
      if (size > limit) throw Error("File exceeds byte budget");
      chunks.push(b.subarray(0, n));
    }
    return Buffer.concat(chunks);
  } finally {
    closeSync(fd);
  }
}
export function directory(path) {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink())
    throw Error("Expected a real directory");
}
