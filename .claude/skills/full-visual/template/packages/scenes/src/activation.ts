import { assertAttributes, assertEmptyElement, createMarkupSurfaceFacet, textAttribute } from "@hypit/hypit/markup";
import { canonicalize, sameType } from "@hypit/hypit/protocol";
import { sealGraphFragment } from "@hypit/hypit/author";
import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { FragmentOperation } from "@hypit/hypit/author";
import type { ModuleManifest, TypeRef } from "@hypit/hypit/protocol";
import type { StructuredSurfaceHandler, SurfaceResolvedReference } from "@hypit/hypit/markup";
import { compositionTypes } from "@hypit/composition";
import type { Timeline } from "@hypit/timeline";
import { timelineTypes } from "@hypit/timeline";
import { spatialTypes } from "@hypit/spatial";
import type { SpatialFrame } from "@hypit/spatial";
import { temporalTypes } from "@hypit/temporal";
import type { TemporalWindow } from "@hypit/temporal";
import { resolveTemporalContext, resolveTemporalWindowReference, temporalContextAttributeVocabulary,
  temporalWindowAttributeNames, temporalWindowAttributeVocabulary } from "@hypit/temporal/markup";
import { renderExplainer } from "./render.js";
import type { ExplainerOptions, Item } from "./render.js";

const module = { name: "@explainer/scenes", version: "1" } as const;
const types = Object.fromEntries(["Options", "Item", "Items"].map(name => [name, { module, name }])) as Record<"Options" | "Item" | "Items", TypeRef>;
const producers = Object.fromEntries(["empty", "append", "render"].map(name => [name, { module, name }])) as Record<"empty" | "append" | "render", { module: typeof module; name: string }>;

export const manifest: ModuleManifest = { format: "hypit.module@1", ...module,
  dependencies: [compositionTypes.visualTrack, timelineTypes.timeline, spatialTypes.frame, temporalTypes.window].map(type => ({ module: type.module })),
  types: Object.values(types).map(type => ({ name: type.name })), capabilities: [], producers: [
    { name: "empty", inputs: [], outputs: [{ name: "items", type: types.Items }], needs: [] },
    { name: "append", inputs: [{ name: "items", type: types.Items }, { name: "item", type: types.Item },
      { name: "window", type: temporalTypes.window }], outputs: [{ name: "items", type: types.Items }], needs: [] },
    { name: "render", inputs: [{ name: "items", type: types.Items }, { name: "options", type: types.Options },
      { name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
      { name: "window", type: temporalTypes.window }], outputs: [{ name: "visual", type: compositionTypes.visualTrack }], needs: [] },
  ],
};

const inline = <T>(record: { value: { kind: string; value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("Explainer inputs must be inline values.");
  return record.value.value as T;
};
const value = (data: unknown) => ({ kind: "inline" as const, value: canonicalize(data) });

const component: ProducerPackage & AdmissionPackage = { producers: [
  { producer: producers.empty, handler: () => ({ outputs: { items: value([]) }, needs: {} }) },
  { producer: producers.append, handler: ({ inputs }) => {
    const item = inline<Omit<Item, "window">>(inputs.item), window = inline<TemporalWindow>(inputs.window);
    return { outputs: { items: value([...inline<Item[]>(inputs.items), { ...item, window }]) }, needs: {} };
  } },
  { producer: producers.render, handler: ({ inputs }) => ({ outputs: { visual: value(renderExplainer(
    inline<Timeline>(inputs.timeline), inline<SpatialFrame>(inputs.within), inline<TemporalWindow>(inputs.window),
    inline<Item[]>(inputs.items), inline<ExplainerOptions>(inputs.options))) }, needs: {} }) },
] };

export const decodeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "within", ...temporalWindowAttributeNames]);
  const id = textAttribute(element, "id"), context = resolveTemporalContext({ element, resolveReference });
  const window = resolveTemporalWindowReference({ element, resolveReference });
  const raw = element.attributes.within;
  if (typeof raw !== "object" || raw.kind !== "reference") throw new Error("within must be a reference.");
  const within = resolveReference(raw.path);
  if (within === undefined || !sameType(within.type, spatialTypes.frame)) throw new Error("within must be a spatial Frame.");
  const options: ExplainerOptions = { id };
  const records = [{ id: `${id}.options`, type: types.Options, value: value(options), range: element.range }];
  const inputs = [{ name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
    { name: "window", type: temporalTypes.window }, { name: "options", type: types.Options }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { timeline: context.timeline.ref, within: within.ref,
    window: window.ref, options: { kind: "record", id: `${id}.options` } };
  const input = (name: string) => ({ kind: "fragment-input" as const, name });
  const operation = (name: string) => ({ kind: "fragment-operation" as const, operation: name });
  const operations: FragmentOperation[] = [{ id: "empty", producer: producers.empty, inputs: {}, result: { kind: "output", name: "items" } }];
  let previous = "empty", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("Explainer accepts Part and Line children."); continue; }
    const tag = child.name.split(":").at(-1);
    let item: Omit<Item, "window">;
    if (tag === "Part") {
      assertAttributes(child, ["name", ...temporalWindowAttributeNames]); assertEmptyElement(child);
      const name = textAttribute(child, "name");
      if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Part name ${name} must be lowercase letters, digits or hyphens.`);
      item = { kind: "part", name };
    } else if (tag === "Line") {
      assertAttributes(child, ["part", "text", ...temporalWindowAttributeNames]); assertEmptyElement(child);
      item = { kind: "line", name: textAttribute(child, "part"), text: textAttribute(child, "text") };
    } else throw new Error("Explainer accepts Part and Line children.");
    const during = resolveTemporalWindowReference({ element: child, resolveReference });
    const key = `item-${++index}`;
    records.push({ id: `${id}.${key}`, type: types.Item, value: value(item), range: child.range });
    inputs.push({ name: key, type: types.Item }, { name: `${key}-window`, type: temporalTypes.window });
    bindings[key] = { kind: "record", id: `${id}.${key}` }; bindings[`${key}-window`] = during.ref;
    operations.push({ id: key, producer: producers.append, inputs: { items: operation(previous), item: input(key), window: input(`${key}-window`) },
      result: { kind: "output", name: "items" } });
    previous = key;
  }
  if (!index) throw new Error("Explainer needs Part and Line children.");
  operations.push({ id: "render", producer: producers.render, inputs: { items: operation(previous), options: input("options"),
    timeline: input("timeline"), within: input("within"), window: input("window") }, result: { kind: "output", name: "visual" } });
  const fragment = sealGraphFragment({ inputs, operations, exports: [{ name: "visual", type: compositionTypes.visualTrack, root: operation("render") }] });
  return { records, fragments: [fragment], components:
    [{ id, fragment: fragment.id, inputs: bindings, outputs: { visual: `${id}.visual` }, range: element.range }], exports: [`${id}.visual`] };
};

const declaration = { name: "explainer", tag: "Explainer", mode: "structured" as const,
  outputs: [compositionTypes.visualTrack, ...Object.values(types)],
  vocabulary: { summary: "Narrated visual explainer: project-drawn scenes and captions timed by Parts and Lines.", attributes: [
    ...temporalContextAttributeVocabulary, ...temporalWindowAttributeVocabulary,
    { name: "id", kind: "literal" as const, required: true, summary: "Track identity." },
    { name: "within", kind: "expression" as const, required: true, summary: "Picture Frame, normally canvas.bounds." },
  ], children: [
    { tag: "Part", cardinality: "many" as const, summary: "One scene and the Window it occupies.", attributes: [
      { name: "name", kind: "literal" as const, required: true, summary: "Scene id used by the design (window.TL scene id)." }, ...temporalWindowAttributeVocabulary] },
    { tag: "Line", cardinality: "many" as const, summary: "One narrated sentence shown as a caption and driving its scene's motion.", attributes: [
      { name: "part", kind: "literal" as const, required: true, summary: "Owning Part name." },
      { name: "text", kind: "literal" as const, required: true, summary: "Caption text, identical to the narration." }, ...temporalWindowAttributeVocabulary] },
  ], ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The complete explainer picture." }],
    example: '<ex:Explainer id="ex" timeline={program.timeline} within={canvas.bounds} during={program.window}><ex:Part name="abertura" during={program.abertura}/><ex:Line part="abertura" text="..." during={program.l01}/></ex:Explainer>',
  },
};

export const hypitPackage = { format: "hypit.package@1" as const, modules: [{ manifest }],
  facets: [createProducerPackageFacet(component), createAdmissionPackageFacet(component),
    createMarkupSurfaceFacet({ module, declaration, handler: decodeSurface })] };
export default hypitPackage;
