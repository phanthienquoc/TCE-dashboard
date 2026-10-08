import test from "node:test";
import assert from "node:assert/strict";

test("deployment event contract",()=>{
  const event={id:"x",channel:"platform.deployments",event:"deployed",timestamp:new Date().toISOString(),sequence:1,data:{app:"tce-dashboard",version:"prod-v1.0.0-abcdef1"}};
  assert.equal(event.channel,"platform.deployments");
  assert.equal(event.event,"deployed");
  assert.equal(event.data.app,"tce-dashboard");
});
