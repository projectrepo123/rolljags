import { downloadZip } from "client-zip";
import { listObjects } from "../lib/r2.js";

export async function handleZip(env, year, week, level) {
  const prefix = `${year}/${week}/${level}/`;
  const objects = await listObjects(env.PHOTOS, prefix);

  if (objects.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const metadata = objects.map((obj) => ({
    name: obj.key.split("/").pop(),
    size: obj.size,
    lastModified: obj.uploaded,
  }));

  async function* files() {
    for (const obj of objects) {
      const fileObj = await env.PHOTOS.get(obj.key);
      if (!fileObj) continue;
      yield {
        name: obj.key.split("/").pop(),
        input: fileObj.body,
        size: obj.size,
        lastModified: obj.uploaded,
      };
    }
  }

  const zipResponse = downloadZip(files(), { metadata });
  const filename = `${year}-${week}-${level}.zip`;
  zipResponse.headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  return zipResponse;
}
