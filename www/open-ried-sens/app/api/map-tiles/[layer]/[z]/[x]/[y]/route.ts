import { proxyBackend } from "@/lib/collectedBackend";
export async function GET(_request: Request, { params }: { params: Promise<{layer:string; z:string; x:string; y:string}> }) {
 const {layer,z,x,y} = await params;
 if (!/^(base|rain)$/.test(layer) || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+\.png$/.test(y)) return new Response(null,{status:404});
 return proxyBackend(`map-tiles/${layer}/${z}/${x}/${y}`, 86400);
}
