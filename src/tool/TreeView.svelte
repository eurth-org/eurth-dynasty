<script lang="ts">
  /*
   * The tree on the page: the same layout and the same words as the downloaded picture, but each
   * person is a button. Click one, or move between them with the arrow keys and press Enter.
   * It scrolls like any page (touch, wheel, scroll bars), and can be dragged with a mouse.
   *
   * The signature touch lives here: when the reigning person changes, the crown flies from the
   * old card to the new one. Nothing moves for reduced motion.
   */
  import { calm, playTones } from '@eurth/style';
  import { tick, untrack } from 'svelte';
  import { neighbours, readingOrder, type Layout } from '../dynasty/layout';
  import type { Tree } from '../dynasty/model';
  import { cardText, CROWN_PATH, linkPath, type CardText } from '../dynasty/render';
  import type { Succession } from '../dynasty/succession';

  let {
    tree,
    layout,
    succession,
    zoom,
    selected,
    onselect,
    label,
  }: {
    tree: Tree;
    layout: Layout;
    succession: Succession;
    /** 1 is life size. */
    zoom: number;
    selected: string | undefined;
    onselect: (id: string) => void;
    /** What the tree is called, for screen readers. */
    label: string;
  } = $props();

  let viewport: HTMLDivElement | undefined = $state();
  let flyer: SVGGElement | undefined = $state();
  /** The card the Tab key lands on: the last one visited. */
  let current = $state<string | undefined>(undefined);
  /** The card whose own crown is hidden while the flying one is on its way. */
  let arriving = $state<string | undefined>(undefined);

  const texts = $derived.by(() => {
    const map = new Map<string, CardText>();
    for (const person of tree.people) map.set(person.id, cardText(tree, succession, person));
    return map;
  });
  const order = $derived(readingOrder(layout));
  const tabStop = $derived(current !== undefined && order.includes(current) ? current : selected !== undefined && order.includes(selected) ? selected : order[0]);

  const cardElement = (id: string): SVGGElement | null => viewport?.querySelector<SVGGElement>(`[data-person="${CSS.escape(id)}"]`) ?? null;

  function go(id: string | undefined) {
    if (id === undefined) return;
    current = id;
    const element = cardElement(id);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
  }

  function onkeydown(event: KeyboardEvent, id: string) {
    const next = neighbours(layout, tree, id);
    const moves: Record<string, string | undefined> = {
      ArrowLeft: next.left,
      ArrowRight: next.right,
      ArrowUp: next.up,
      ArrowDown: next.down,
      Home: order[0],
      End: order.at(-1),
    };
    if (event.key in moves) {
      event.preventDefault();
      go(moves[event.key]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onselect(id);
    }
  }

  // Dragging the background with a mouse moves the view. Touch and the wheel already scroll it.
  let drag: { x: number; y: number; left: number; top: number } | null = null;
  function onpointerdown(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !viewport || (event.target as Element).closest('[data-person]')) return;
    drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
  }
  function onpointermove(event: PointerEvent) {
    if (!drag || !viewport) return;
    viewport.scrollLeft = drag.left - (event.clientX - drag.x);
    viewport.scrollTop = drag.top - (event.clientY - drag.y);
  }
  function onpointerup() {
    drag = null;
  }

  // The crown passes along the line.
  let wasReigning: string | undefined = undefined;
  let started = false;
  $effect(() => {
    const now = succession.reigning;
    const before = wasReigning;
    wasReigning = now;
    if (!started) {
      started = true;
      return;
    }
    if (now === undefined || before === undefined || now === before) return;
    untrack(() => {
      const from = layout.cards.find((card) => card.id === before);
      const to = layout.cards.find((card) => card.id === now);
      playTones([[523, 0, 0.03], [659, 0.09, 0.03], [784, 0.18, 0.035]], { length: 0.22 });
      if (!from || !to || !flyer || calm() || typeof flyer.animate !== 'function') return;
      arriving = now;
      flyer.style.display = 'block';
      const flight = flyer.animate(
        [
          { transform: `translate(${from.x + 12}px, ${from.y + 9}px) scale(1)` },
          { transform: `translate(${(from.x + to.x) / 2 + 12}px, ${Math.min(from.y, to.y) - 14}px) scale(1.6)`, offset: 0.5 },
          { transform: `translate(${to.x + 12}px, ${to.y + 9}px) scale(1)` },
        ],
        { duration: 450, easing: 'ease-in-out' },
      );
      const land = () => {
        arriving = undefined;
        if (flyer) flyer.style.display = 'none';
      };
      flight.onfinish = land;
      flight.oncancel = land;
      void tick().then(() => cardElement(now)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }));
    });
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="viewport" bind:this={viewport} {onpointerdown} {onpointermove} {onpointerup} onpointercancel={onpointerup}>
  {#if layout.cards.length}
    <svg
      class="tree"
      width={Math.round(layout.width * zoom)}
      height={Math.round(layout.height * zoom)}
      viewBox="0 0 {layout.width} {layout.height}"
      role="group"
      aria-label="{label}. Arrow keys move between people; Enter picks one to edit."
    >
      <g class="links" aria-hidden="true">
        {#each layout.links as link, i (i)}
          <path d={linkPath(link.points)} class:dashed={link.dashed} />
        {/each}
      </g>
      {#each layout.cards as card (card.id)}
        {@const text = texts.get(card.id)}
        {#if text}
          <g
            class="person"
            class:chosen={selected === card.id}
            class:in-line={text.reigning || text.place !== undefined}
            data-person={card.id}
            role="button"
            tabindex={tabStop === card.id ? 0 : -1}
            aria-label={text.label}
            aria-pressed={selected === card.id}
            onclick={() => {
              current = card.id;
              onselect(card.id);
            }}
            onkeydown={(event) => onkeydown(event, card.id)}
            onfocus={() => (current = card.id)}
          >
            {#if text.heir}
              <!-- The ring: a second outline clear of the card, so the heir reads without colour. -->
              <rect class="ring" x={card.x - 5} y={card.y - 5} width={card.width + 10} height={card.height + 10} rx="16" />
            {/if}
            <rect class="box" x={card.x} y={card.y} width={card.width} height={card.height} rx="12" />
            <svg x={card.x} y={card.y} width={card.width} height={card.height} aria-hidden="true">
              {#if text.reigning}
                <path class="crown" class:away={arriving === card.id} transform="translate(12 9)" d={CROWN_PATH} />
              {/if}
              {#if text.tag}
                <text class="tag" x={text.reigning ? 34 : 12} y="20">{text.tag}</text>
              {/if}
              {#each text.name as line, i (i)}
                <text class="name" x="12" y={42 + i * 18}>{line}</text>
              {/each}
              {#if text.dates}
                <text class="dates" x="12" y={card.height - 11}>{text.dates}</text>
              {/if}
            </svg>
          </g>
        {/if}
      {/each}
      <g class="flyer" bind:this={flyer} aria-hidden="true"><path class="crown" d={CROWN_PATH} /></g>
    </svg>
  {:else}
    <p class="eu-muted empty">Nobody here yet. Add a person to begin.</p>
  {/if}
</div>

<style>
  .viewport {
    overflow: auto;
    max-height: 70vh;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    cursor: grab;
  }

  .viewport:active {
    cursor: grabbing;
  }

  .tree {
    display: block;
  }

  .empty {
    margin: 0;
    padding: var(--space-6);
  }

  .links path {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .links .dashed {
    stroke-dasharray: 6 5;
  }

  .person {
    cursor: pointer;
    outline: none;
  }

  .box {
    fill: var(--surface-raised);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }

  .person:hover .box {
    fill: var(--hover);
  }

  /* Chosen for editing: a heavier outline in the text colour, and the editor below says who. */
  .chosen .box {
    stroke: var(--ink);
    stroke-width: 3;
  }

  .person:focus-visible .box {
    stroke: var(--focus-ring);
    stroke-width: 4;
  }

  .ring {
    fill: none;
    stroke: var(--accent-text);
    stroke-width: 3;
  }

  .tag {
    fill: var(--ink-muted);
    font: 700 13px var(--font-sans);
  }

  .in-line .tag {
    fill: var(--accent-text);
  }

  .name {
    fill: var(--ink);
    font: 400 15px var(--font-sans);
  }

  .dates {
    fill: var(--ink-muted);
    font: 400 13px var(--font-mono);
  }

  .person:hover .tag,
  .person:hover .dates {
    fill: var(--ink);
  }

  .crown {
    fill: var(--caution-text);
  }

  .crown.away {
    visibility: hidden;
  }

  .flyer {
    display: none;
    pointer-events: none;
  }
</style>
