import test from 'node:test';
import assert from 'node:assert/strict';
import {template,propose} from '../src/core.mjs';
import {layerOf,systemView,proposalDiff} from '../src/levels.mjs';
test('blocks map to layers by behaviour, references by category',()=>{
  const p=template();
  assert.deepEqual(p.nodes.map(n=>layerOf(n).id),['data','intelligence','intelligence','governance','delivery']);
  assert.equal(layerOf({data:{kind:'resource',category:'Compute'}}).id,'infra:compute');
});
test('system view groups blocks and aggregates wires between layers',()=>{
  const {nodes,edges}=systemView(template());
  assert.deepEqual(nodes.map(n=>n.data.layer),['data','intelligence','governance','delivery']);
  assert.equal(nodes.find(n=>n.data.layer==='intelligence').data.blocks.length,2);
  assert.equal(edges.length,3);
  assert.ok(edges.every(e=>e.source!==e.target));
  assert.deepEqual(nodes.map(n=>n.position.x),[0,320,640,960]);
});
test('layer status reflects its blocks',()=>{
  const {nodes}=systemView(template(),{'block-1':'passed','block-2':'failed'});
  const intelligence=nodes.find(n=>n.data.layer==='intelligence');
  assert.equal(intelligence.data.status,'failed');
  assert.equal(nodes.find(n=>n.data.layer==='data').data.status,'idle');
});
test('cyclic designs still produce a system view',()=>{
  const p=template();p.edges.push({id:'cycle',source:'block-4',target:'block-0'});
  assert.equal(systemView(p).nodes.length,4);
});
test('proposal diff reports added and changed blocks',()=>{
  const p=template();
  const tool=proposalDiff(p,propose('Add a business API',p).next);
  assert.deepEqual(tool.added,['Business API']);
  assert.equal(tool.wiresAdded,2);assert.equal(tool.wiresRemoved,1);
  const gcp=proposalDiff(p,propose('Explore Google Cloud',p).next);
  assert.equal(gcp.added.length,0);assert.ok(gcp.changed.length>=3);
});
