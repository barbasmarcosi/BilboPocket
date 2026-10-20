// Excel (OpenXML) reader without external services or CDNs.
// Supports .xlsx/.xlsm and delimited CSV. Parsing happens entirely on-device.
const decoder = new TextDecoder();
const MAX_FILE = 12 * 1024 * 1024;
const MAX_ITEM = 12 * 1024 * 1024;
const MAX_SHEETS = 50;
const MAX_ROWS = 20000;

function zipEntries(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let end = -1;
  for (let i=bytes.length-22; i>=Math.max(0,bytes.length-65557); i--) {
    if (view.getUint32(i,true)===0x06054b50) { end=i; break; }
  }
  if (end<0) throw new Error('El archivo no es un Excel XLSX válido (ZIP incompleto).');
  const count=view.getUint16(end+10,true), offset=view.getUint32(end+16,true);
  if (count>10000 || offset===0xffffffff) throw new Error('Formato ZIP demasiado grande o no compatible.');
  const out=new Map();
  let p=offset;
  for (let i=0;i<count;i++) {
    if (p+46>bytes.length || view.getUint32(p,true)!==0x02014b50) throw new Error('Directorio ZIP inválido.');
    const flags=view.getUint16(p+8,true), method=view.getUint16(p+10,true);
    const size=view.getUint32(p+20,true), expanded=view.getUint32(p+24,true);
    const len=view.getUint16(p+28,true), extra=view.getUint16(p+30,true), comment=view.getUint16(p+32,true);
    const at=view.getUint32(p+42,true);
    if (p+46+len+extra+comment>bytes.length) throw new Error('ZIP truncado.');
    const name=decoder.decode(bytes.subarray(p+46,p+46+len)).replaceAll('\\','/');
    p+=46+len+extra+comment;
    if (!name.startsWith('xl/') || name.endsWith('/')) continue;
    if ((flags&1) || size===0xffffffff || expanded===0xffffffff) throw new Error('Excel cifrado o ZIP64 no compatible.');
    if (expanded>MAX_ITEM || size>MAX_FILE) throw new Error('El Excel contiene una hoja demasiado grande.');
    if (at+30>bytes.length || view.getUint32(at,true)!==0x04034b50) throw new Error('Entrada ZIP inválida.');
    const start=at+30+view.getUint16(at+26,true)+view.getUint16(at+28,true);
    if (start+size>bytes.length) throw new Error('Entrada ZIP incompleta.');
    out.set(name,{method,size,expanded,start});
  }
  return {bytes,entries:out};
}
async function unzipText(zip,name) {
  const item=zip.entries.get(name);
  if (!item) return null;
  const compressed=zip.bytes.subarray(item.start,item.start+item.size);
  let raw;
  if (item.method===0) raw=compressed;
  else if(item.method===8) {
    if (typeof DecompressionStream==='undefined') throw new Error('Tu navegador no puede descomprimir XLSX. Actualizalo o exportá como CSV.');
    try {
      const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      raw=new Uint8Array(await new Response(stream).arrayBuffer());
    } catch { throw new Error('No se pudo descomprimir el archivo. Revisá que no esté dañado.'); }
  } else throw new Error('Compresión de Excel no compatible.');
  if (raw.length>MAX_ITEM || raw.length!==item.expanded) throw new Error('Contenido XLSX dañado o demasiado grande.');
  return decoder.decode(raw);
}
function xml(text,name) {
  if (!text) throw new Error('Falta '+name+' en el XLSX.');
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido en '+name+'.');
  return doc;
}
const nodes=(doc,tag)=>Array.from(doc.getElementsByTagNameNS('*',tag));
const children=(node,tag)=>Array.from(node.children||[]).filter(x=>x.localName===tag);
const child=(node,tag)=>children(node,tag)[0];
const str=node=>node?.textContent??'';
function asCol(cellReference) {
  const code=String(cellReference).match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  let n=0;for (const l of code)n=n*26+l.charCodeAt(0)-64;
  return n-1;
}
function normPath(source,target) {
  const base=target.startsWith('/')?target.slice(1):'xl/'+target;
  const parts=[];
  for(const p of base.split('/')){if(p==='..')parts.pop();else if(p&&p!=='.')parts.push(p);}
  return parts.join('/');
}
function parseSheet(document,shared) {
  const rows=[];
  const xmlRows=nodes(document,'row');
  if(xmlRows.length>MAX_ROWS) throw new Error('La hoja supera el límite de filas.');
  for (const row of xmlRows) {
    const cells=[];
    let automatic=0;
    for(const c of children(row,'c')) {
      const position=c.getAttribute('r');
      const col=position?asCol(position):automatic;
      automatic=col+1;
      if(col<0 || col>150) continue;
      const type=c.getAttribute('t');
      let value;
      if(type==='inlineStr')value=nodes(c,'t').map(str).join('');
      else {
        const v=str(child(c,'v'));
        if(type==='s') value=shared[Number(v)]??'';
        else if(type==='str'||type==='e') value=v;
        else if(type==='b') value=v==='1';
        else if(type==='d') value=v;
        else value=v!=='' && Number.isFinite(Number(v))?Number(v):v;
      }
      cells[col]=value;
    }
    if(cells.length)rows.push({number:Number(row.getAttribute('r'))||rows.length+1,cells});
  }
  return rows;
}
function csvRows(text) {
  const first=text.slice(0,4096).split(/\r?\n/).find(x=>x.trim())||'';
  const separator=[';','\t',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const out=[], rows=[];
  let field='',inside=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"' && inside && text[i+1]==='"'){field+='"';i++;}
    else if(c==='"')inside=!inside;
    else if(!inside && c===separator){out.push(field);field='';}
    else if(!inside && (c==='\n'||c==='\r')){
      out.push(field);field='';if(out.some(x=>x.trim()))rows.push({number:rows.length+1,cells:out.splice(0)});
      else out.length=0;
      if(c==='\r' && text[i+1]==='\n')i++;
    }else field+=c;
    if(rows.length>MAX_ROWS)throw new Error('El CSV contiene demasiadas filas.');
  }
  out.push(field);if(out.some(x=>x.trim()))rows.push({number:rows.length+1,cells:out});
  return [{name:'CSV',rows}];
}
export async function readExcelWorkbook(file) {
  if(!file || file.size>MAX_FILE)throw new Error('Elegí un Excel de hasta 12 MB.');
  const name=String(file.name||'').toLowerCase();
  if(name.endsWith('.csv') || name.endsWith('.tsv'))return {sheets:csvRows((await file.text()).replace(/^\ufeff/,'')),kind:'csv'};
  if(name.endsWith('.xls'))throw new Error('El Excel .xls antiguo no es compatible. Abrilo en Excel y guardalo como .xlsx.');
  if(!/\.(xlsx|xlsm)$/.test(name))throw new Error('Seleccioná un archivo .xlsx, .xlsm o .csv.');
  const data=await file.arrayBuffer(), zip=zipEntries(data);
  const book=xml(await unzipText(zip,'xl/workbook.xml'),'workbook.xml');
  const rel=xml(await unzipText(zip,'xl/_rels/workbook.xml.rels'),'relaciones del libro');
  const relationships=new Map(nodes(rel,'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  const sharedXml=await unzipText(zip,'xl/sharedStrings.xml');
  const shared=sharedXml?nodes(xml(sharedXml,'sharedStrings.xml'),'si').map(si=>nodes(si,'t').map(str).join('')):[];
  const sheets=[];
  for(const element of nodes(book,'sheet').slice(0,MAX_SHEETS)){
    const title=element.getAttribute('name')||'Hoja';
    const id=element.getAttribute('r:id') || element.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const path=normPath('xl/workbook.xml',relationships.get(id)||'');
    if(!zip.entries.has(path))continue;
    const sheetXml=xml(await unzipText(zip,path),title);
    sheets.push({name:title,rows:parseSheet(sheetXml,shared),date1904:nodes(book,'workbookPr')[0]?.getAttribute('date1904')==='1'});
  }
  if(!sheets.length)throw new Error('No se encontraron hojas de cálculo en el Excel.');
  return {sheets,kind:'xlsx'};
}
