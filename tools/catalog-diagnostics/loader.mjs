import {pathToFileURL} from 'node:url';
const core=new URL('./native-stub.mjs',import.meta.url).href;
export async function resolve(specifier,context,next){
  if(specifier==='@ps5-react/core')return {url:core,shortCircuit:true};
  if(specifier==='react')return {url:pathToFileURL(process.env.CATALOG_REACT_PATH).href,shortCircuit:true};
  return next(specifier,context);
}
