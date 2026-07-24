import { describe, it, expect, vi } from "vitest";
import { Dispatcher, InMemoryConfigLoader } from "../dispatcher";
import { createTransformPipeline } from "../pipeline/pipeline";
import { normalizeTransform }      from "../pipeline/transforms/normalize";
import type { DeliveryQueue }      from "../queue";
import type { DeliveryJob }        from "../types";
import { makeConfig } from "./helpers";
import type { BusEvent } from "../../event-bus/types";

function makeBusEvent(overrides: Partial<BusEvent> = {}): BusEvent {
  return {
    id:            "bus-001",
    correlationId: "corr-xyz",
    type:          "form.started",
    source:        "test",
    timestamp:     Date.now(),
    payload:       { formSlug: "test-form", sessionToken: "tok-1" },
    meta:          {},
    ...overrides,
  };
}

function makeQueue(): { queue: DeliveryQueue; jobs: DeliveryJob[] } {
  const jobs: DeliveryJob[] = [];
  const queue = { enqueue: (job: DeliveryJob) => { jobs.push(job); } } as unknown as DeliveryQueue;
  return { queue, jobs };
}

const pipeline = createTransformPipeline([normalizeTransform]);

describe("Dispatcher — basic routing", () => {
  it("dispatches to queue for matching enabled config", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [makeConfig()]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent());
    expect(jobs).toHaveLength(1);
  });

  it("does not dispatch when formSlug is empty", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [makeConfig()]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent({ payload: { formSlug: "", sessionToken: "" } }));
    expect(jobs).toHaveLength(0);
  });

  it("skips disabled configs", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [makeConfig({ enabled: false })]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent());
    expect(jobs).toHaveLength(0);
  });

  it("applies eventFilter — skips non-matching events", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [
      makeConfig({ eventFilter: ["form.completed"] }),
    ]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent({ type: "form.started" }));
    expect(jobs).toHaveLength(0);
  });

  it("applies eventFilter — passes matching events", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [
      makeConfig({ eventFilter: ["form.started"] }),
    ]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent({ type: "form.started" }));
    expect(jobs).toHaveLength(1);
  });

  it("dispatches one job per enabled config", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [
      makeConfig({ id: "c1" }),
      makeConfig({ id: "c2" }),
    ]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent());
    expect(jobs).toHaveLength(2);
  });

  it("sends Meta only for the dedicated phone event", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [
      makeConfig({
        adapterName: "meta-pixel",
        settings: { pixel_id: "1234567890", event: "Lead" },
        eventFilter: ["form.started", "form.step.completed", "form.completed"],
      }),
    ]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });

    await d.dispatch(makeBusEvent({ type: "form.started" }));
    await d.dispatch(makeBusEvent({ type: "form.step.completed" }));
    expect(jobs).toHaveLength(0);

    await d.dispatch(makeBusEvent({
      type: "form.phone.answered",
      payload: { formSlug: "test-form", stepId: "phone-1", stepType: "phone" },
    }));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].event.type).toBe("form.phone.answered");
  });
});

describe("Dispatcher — deliveryId and correlationId", () => {
  it("sets deliveryId as 'eventId:configId'", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [makeConfig({ id: "cfg-99" })]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent({ id: "evt-42" }));
    expect(jobs[0].deliveryId).toBe("evt-42:cfg-99");
  });

  it("propagates correlationId from BusEvent", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [makeConfig()]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent({ correlationId: "CORR-999" }));
    expect(jobs[0].correlationId).toBe("CORR-999");
  });

  it("event in job is the transformed version (has transforms[])", async () => {
    const loader = new InMemoryConfigLoader().set("test-form", [makeConfig()]);
    const { queue, jobs } = makeQueue();
    const d = new Dispatcher({ pipeline, queue, configLoader: loader });
    await d.dispatch(makeBusEvent());
    expect(jobs[0].event.transformed).toBe(true);
    expect(jobs[0].event.transforms).toContain("normalize");
  });
});

describe("InMemoryConfigLoader", () => {
  it("returns empty array for unknown formSlug", async () => {
    const loader = new InMemoryConfigLoader();
    expect(await loader.load("unknown")).toEqual([]);
  });

  it("returns configs set via set()", async () => {
    const loader = new InMemoryConfigLoader().set("f1", [makeConfig()]);
    const configs = await loader.load("f1");
    expect(configs).toHaveLength(1);
  });

  it("set() is chainable", () => {
    const loader = new InMemoryConfigLoader();
    expect(loader.set("f1", [makeConfig()])).toBe(loader);
  });
});
