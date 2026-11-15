<script lang="ts">
  /*
   * Dynasty, the tool: a house, its law, its tree, and who inherits.
   *
   *   - The tree lives in its link (?d=…), read safely on arrival and kept in step after. A tree
   *     too big for a link is kept in the profile file instead, and the page says so.
   *   - Nothing is stored: "save" is a link, a picture, a GEDCOM file or the nation's profile.
   *   - Every change goes through src/dynasty/edit.ts and gives a new tree, so undo is a list of
   *     the old ones, in memory, for this visit.
   *   - The line of succession is worked out again on every change. The heir has a word and a
   *     ring, in the tree and in the list.
   */
  import {
    faArrowDown,
    faArrowUp,
    faCheck,
    faCopy,
    faDownload,
    faEraser,
    faExpand,
    faFileExport,
    faFileImport,
    faForward,
    faLightbulb,
    faRotateLeft,
    faRotateRight,
    faTriangleExclamation,
    faUserPlus,
    faXmark,
  } from '@fortawesome/free-solid-svg-icons';
  import { createProfile, getSection, setSection, type EurthProfile } from '@eurth/profile';
  import ProfileButtons from '@eurth/profile/ProfileButtons.svelte';
  import { copyText, download, fileSlug, getPrefs, niceWatcher, onPrefs, PICTURE_SIZES, stateToLocation, svgToPicture, toast } from '@eurth/style';
  import Icon from '@eurth/style/components/Icon.svelte';
  import ShareButtons from '@eurth/style/components/ShareButtons.svelte';
  import { onMount, tick } from 'svelte';
  import { describeLine, summarise } from '../dynasty/describe';
  import { addPerson, addPick, movePick, removePick, startTree, updateHouse } from '../dynasty/edit';
  import { varenko } from '../dynasty/examples';
  import { fromGedcom, toGedcom } from '../dynasty/gedcom';
  import { encodeTree, LINK_PARAM, LINK_VERSION, MAX_STATE, packTree, treeFromSearch } from '../dynasty/link';
  import { displayName, indexTree, isDead, lawHints, lawNames, laws, MAX_NAME, type Exclusions, type Law, type Tree } from '../dynasty/model';
  import { fromSection, hasTree, toSection } from '../dynasty/profile';
  import { drawingLayout, treeSvg } from '../dynasty/render';
  import { claimText, lineOfSuccession, reasonText } from '../dynasty/succession';
  import { checkTree, GRANDPARENT_TOAST, ownGrandparents } from '../dynasty/validate';
  import { eventKinds, eventNames, eventPeople, whatIf, type EventKind } from '../dynasty/whatif';
  import { ahnentafelSubject, toWikitext, wikiFormats, type WikiFormat } from '../dynasty/wikitext';
  import { paletteFor, type Theme } from './palette';
  import PersonEditor from './PersonEditor.svelte';
  import TreeView from './TreeView.svelte';

  // Passed in by the page: browser code never imports eurth.config.mjs (see the note there).
  let { siteName, siteUrl }: { siteName: string; siteUrl: string } = $props();

  let tree = $state.raw<Tree>(varenko());
  let past = $state.raw<Tree[]>([]);
  let future = $state.raw<Tree[]>([]);
  let selected = $state<string | undefined>(undefined);
  let profile = $state.raw<EurthProfile | null>(null);
  let ready = $state(false);
  let theme = $state<Theme>('dark');
  /** Per cent. 65 is as small as it goes: below that a card is too small to press. */
  let zoom = $state(65);
  let stageWidth = $state(0);
  let slider: HTMLInputElement | undefined = $state();
  let gedcomInput: HTMLInputElement | undefined = $state();
  let eventPerson = $state('');
  let eventKind = $state<EventKind>('dies');
  let size = $state('drawn');
  let wikiFormat = $state<WikiFormat>('tree-chart');

  const index = $derived(indexTree(tree));
  const succession = $derived(lineOfSuccession(tree));
  const layout = $derived(drawingLayout(tree));
  const notes = $derived(checkTree(tree));
  const name = (id: string | undefined): string => displayName(id === undefined ? undefined : index.person.get(id));
  const houseName = $derived(tree.house || 'Your house');

  // The link holds the whole tree, when the tree is small enough to fit in one.
  const state = $derived(encodeTree(tree));
  const fits = $derived(state.length <= MAX_STATE);
  const link = $derived.by(() => {
    const base = ready ? `${location.origin}${location.pathname}` : `${siteUrl}/`;
    return fits ? `${base}?${LINK_PARAM}=${state}` : base;
  });

  const palette = $derived(paletteFor(theme));
  const picture = $derived(treeSvg(tree, { palette, layout, succession }));
  const pictureSize = $derived.by(() => {
    const found = /viewBox="0 0 (\d+) (\d+)"/.exec(picture);
    return { width: Number(found?.[1] ?? 1200), height: Number(found?.[2] ?? 630) };
  });
  const slug = $derived(fileSlug(tree.house, 'dynasty'));

  // What if.
  const living = $derived(eventPeople(tree));
  const eventWho = $derived(living.includes(eventPerson) ? eventPerson : (living[0] ?? ''));
  const outcome = $derived(eventWho ? whatIf(tree, { person: eventWho, kind: eventKind }) : null);

  // Elective: who may still be added to the list.
  const unpicked = $derived(succession.candidates.filter((id) => !tree.picks.includes(id)));

  function commit(next: Tree, said?: string) {
    if (next === tree) return;
    past = [...past.slice(-99), tree];
    future = [];
    tree = next;
    if (said) toast(said);
  }

  function undo() {
    const last = past.at(-1);
    if (!last) return;
    future = [tree, ...future];
    past = past.slice(0, -1);
    tree = last;
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    past = [...past, tree];
    future = future.slice(1);
    tree = next;
  }

  /** A whole new tree (an example, a file, a clean start): undo still brings the old one back. */
  async function open(next: Tree, said: string) {
    commit(next, said);
    selected = undefined;
    await tick();
    fit();
  }

  function fit() {
    if (!stageWidth || !layout.width) return;
    zoom = Math.max(65, Math.min(100, Math.floor(((stageWidth - 4) / layout.width) * 100)));
  }

  function select(id: string | undefined) {
    selected = id;
    if (id !== undefined) void tick().then(() => document.getElementById('editor-title')?.scrollIntoView({ block: 'nearest', behavior: 'auto' }));
  }

  function add() {
    const added = addPerson(tree);
    commit(added.tree, 'A new face. Say who they are, and whose child.');
    select(added.id);
  }

  function resolveTheme(): Theme {
    const chosen = getPrefs().theme;
    if (chosen === 'light' || chosen === 'dark') return chosen;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  onMount(() => {
    // A link is someone else's input: treeFromSearch never throws, and cleans what it reads.
    const arrived = treeFromSearch(location.search);
    if (arrived && arrived.people.length) tree = arrived;
    theme = resolveTheme();
    const stop = onPrefs(() => (theme = resolveTheme()));
    ready = true;
    void tick().then(fit);
    return stop;
  });

  // The address bar follows the tree, so the link can be copied from there too.
  $effect(() => {
    if (!ready) return;
    if (fits) stateToLocation(packTree(tree), { version: LINK_VERSION, param: LINK_PARAM });
    else history.replaceState(history.state, '', location.pathname);
  });

  // The suite's wink: "Nice." when a number settles on 69.
  const watch = niceWatcher();
  $effect(() => watch(zoom, () => slider));

  // This tool's own easter egg: a person who is their own grandparent.
  let hadGrandparent = false;
  $effect(() => {
    const has = ownGrandparents(tree).length > 0;
    if (has && !hadGrandparent && ready) toast(GRANDPARENT_TOAST);
    hadGrandparent = has;
  });

  function setRule(rule: keyof Exclusions, on: boolean) {
    commit(updateHouse(tree, { exclude: { [rule]: on } }));
  }

  const rules: { key: keyof Exclusions; label: string }[] = [
    { key: 'illegitimate', label: 'Born outside marriage' },
    { key: 'renounced', label: 'Renounced' },
    { key: 'out', label: 'Married out' },
    { key: 'adopted', label: 'Adopted' },
  ];

  // Taking it away.
  async function savePicture(type: 'image/png' | 'image/webp') {
    const preset = PICTURE_SIZES.find((entry) => entry.id === size);
    // As drawn: twice life size, so it stays sharp, but never so large that a browser refuses.
    const scale = Math.min(2, 8000 / Math.max(pictureSize.width, pictureSize.height));
    const width = preset?.width ?? Math.round(pictureSize.width * scale);
    const height = preset?.height ?? Math.round(pictureSize.height * scale);
    try {
      download(await svgToPicture(picture, { width, height, type, background: palette.surface }), `${slug}-family-tree.${type === 'image/png' ? 'png' : 'webp'}`);
    } catch {
      toast('The picture could not be made. Try the SVG, which always works.');
    }
  }

  // An ahnentafel is of one person: the one picked in the tree, or else whoever reigns.
  const wikiSubject = $derived(ahnentafelSubject(tree, selected));
  const wikiHint = $derived(wikiFormats.find((format) => format.id === wikiFormat)?.hint ?? '');

  async function copyWikitext() {
    const copied = await copyText(toWikitext(tree, { format: wikiFormat, ...(wikiSubject === undefined ? {} : { subject: wikiSubject }) }));
    toast(copied ? 'Wikitext copied. Paste it into the page’s source on IIWiki.' : 'That didn’t copy. Your browser may not allow it here.');
  }

  async function loadGedcom(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const result = fromGedcom(await file.text());
    if (!result.tree.people.length) {
      toast(result.warnings[0] ?? 'There was nobody in that file.');
      return;
    }
    const count = result.tree.people.length;
    const read = `${count} ${count === 1 ? 'person' : 'people'} read from the file.`;
    await open(result.tree, result.warnings[0] ?? (result.tree.reigning === undefined ? `${read} Now say who reigns.` : read));
  }

  async function loaded(next: EurthProfile) {
    profile = next;
    const section = getSection(next, 'dynasty');
    const nation = next.meta.nation || 'Your nation';
    const found = fromSection(section);
    if (found && found.people.length) await open(found, `${nation} is loaded, family and all.`);
    else if (section && !hasTree(section)) toast(`${nation} is loaded. Its profile names the house but holds no tree yet: draw one, and save it back.`);
    else toast(`${nation} is loaded. It has no dynasty yet. This is where one starts.`);
  }

  // What "Save profile" writes: this tool's own section, and every other section as it was.
  const saved = $derived.by(() => {
    if (!tree.people.length) return profile;
    const base = profile ?? createProfile(tree.realm || tree.house || 'Unnamed nation');
    return setSection(base, 'dynasty', toSection(tree, { previous: getSection(base, 'dynasty'), base: `${siteUrl}/` }) as never);
  });
</script>

<div class="maker">
  <div class="stage" bind:clientWidth={stageWidth}>
    <div class="eu-row stage-top">
      <h2>{houseName}</h2>
      <div class="eu-row">
        <button type="button" class="eu-btn" data-click="bounce" onclick={add}><Icon icon={faUserPlus} /> Add a person</button>
        <button type="button" class="eu-btn eu-btn--icon" aria-label="Undo" data-tip="Undo" data-click="spin" disabled={!past.length} onclick={undo}><Icon icon={faRotateLeft} /></button>
        <button type="button" class="eu-btn eu-btn--icon" aria-label="Redo" data-tip="Redo" data-click="spin" disabled={!future.length} onclick={redo}><Icon icon={faRotateRight} /></button>
        <button type="button" class="eu-btn" data-click="swing-left" onclick={() => open(startTree(), 'A clean slate, and one person on it.')}><Icon icon={faEraser} /> Start again</button>
      </div>
    </div>

    <TreeView {tree} {layout} {succession} zoom={zoom / 100} {selected} onselect={select} label="Family tree of {houseName}" />

    <div class="eu-row zoom">
      <label class="eu-field zoom-field">
        <span class="eu-label">Zoom: <output class="eu-data">{zoom}%</output></span>
        <input bind:this={slider} class="eu-range" type="range" min="65" max="200" step="1" bind:value={zoom} style:--fill="{((zoom - 65) / 135) * 100}%" />
      </label>
      <button type="button" class="eu-btn" data-click="pop" onclick={fit}><Icon icon={faExpand} /> Fit</button>
    </div>
    <p class="eu-help">Pick a person to edit them. The arrow keys move from one to the next; a dashed line leads to a child who was adopted or born outside marriage.</p>

    {#if notes.length}
      <ul class="notes" aria-label="Things to check">
        {#each notes as note, i (i)}
          <li class:problem={note.kind === 'problem'}>
            <Icon icon={note.kind === 'problem' ? faTriangleExclamation : faLightbulb} />
            <span><strong>{note.kind === 'problem' ? 'Check:' : 'Tip:'}</strong> {note.text}</span>
            {#if note.people[0]}
              <button type="button" class="link" onclick={() => select(note.people[0])}>Show {name(note.people[0])}</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if selected !== undefined && index.person.has(selected)}
      <PersonEditor {tree} id={selected} {commit} onselect={select} onclose={() => (selected = undefined)} />
    {/if}

    <section class="take" aria-labelledby="take-title">
      <h2 id="take-title">Take it with you</h2>
      <ShareButtons
        url={link}
        title="{houseName}: {lawNames[tree.law].toLowerCase()}"
        text="{summarise(tree, succession, index)} Made with {siteName}."
        description={() => describeLine(tree, succession, index)}
        picture={() => svgToPicture(picture, { width: 1200, height: 630, background: palette.surface })}
        heading="Share {houseName}"
        said={{ link: fits ? 'Link copied: the whole family is in it.' : 'Link copied, but this tree is too big to ride in it. Save the profile file as well.', description: 'The line of succession is copied, as text.' }}
      />
      {#if !fits}
        <p class="eu-help caution"><Icon icon={faTriangleExclamation} /> This tree is too big for a link. Save the profile file to keep it; that file brings it back for editing.</p>
      {/if}

      <div class="eu-row">
        <label class="eu-field size">
          <span class="eu-label">Picture size</span>
          <select class="eu-select" bind:value={size}>
            <option value="drawn">As drawn</option>
            {#each PICTURE_SIZES as entry (entry.id)}
              <option value={entry.id}>{entry.name}, {entry.width} by {entry.height}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => download(picture, `${slug}-family-tree.svg`, 'image/svg+xml')}><Icon icon={faDownload} /> SVG</button>
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => savePicture('image/png')}><Icon icon={faDownload} /> PNG</button>
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => savePicture('image/webp')}><Icon icon={faDownload} /> WebP</button>
      </div>

      <div class="eu-row">
        <ProfileButtons profile={saved} onload={loaded} onerror={(errors) => toast(`That file isn’t a nation profile we can read${errors[0]?.message ? ` (${errors[0].message.replace(/\.$/, '')})` : ''}. Pick one that ends in .eurth.json.`)} />
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => download(toGedcom(tree), `${slug}.ged`, 'text/plain')}><Icon icon={faFileExport} /> Save GEDCOM</button>
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => gedcomInput?.click()}><Icon icon={faFileImport} /> Load GEDCOM</button>
        <!-- Hidden: the button beside it opens the file picker. -->
        <input bind:this={gedcomInput} hidden type="file" accept=".ged,.gedcom,text/plain" onchange={(e) => loadGedcom(e.currentTarget)} />
      </div>

      <div class="eu-row">
        <label class="eu-field size">
          <span class="eu-label">Wikitext for IIWiki</span>
          <select class="eu-select" bind:value={wikiFormat} aria-describedby="wiki-help">
            {#each wikiFormats as format (format.id)}
              <option value={format.id}>{format.id === 'ahnentafel' && wikiSubject !== undefined ? `Ahnentafel of ${name(wikiSubject)}` : format.name}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="eu-btn" data-click="pop" onclick={copyWikitext}><Icon icon={faCopy} /> Copy wikitext</button>
      </div>
      <p class="eu-help" id="wiki-help">
        {wikiHint}
        {wikiFormat === 'ahnentafel' ? 'Pick someone in the tree to make it theirs.' : 'The line of succession comes with it, as a numbered list.'}
      </p>
      <p class="eu-help">
        The link holds a small tree whole. The profile file holds any tree, and carries your nation from one Eurth tool to the next. GEDCOM is for genealogy programs. Nothing
        is kept in this browser.
      </p>
    </section>
  </div>

  <div class="side">
    <form class="eu-card controls" onsubmit={(e) => e.preventDefault()}>
      <h2>House and law</h2>
      <label class="eu-field">
        <span class="eu-label">House</span>
        <input class="eu-input" value={tree.house} maxlength={MAX_NAME} autocomplete="off" placeholder="House of…" onchange={(e) => commit(updateHouse(tree, { house: e.currentTarget.value }))} />
      </label>
      <label class="eu-field">
        <span class="eu-label">Realm</span>
        <input class="eu-input" value={tree.realm ?? ''} maxlength={MAX_NAME} autocomplete="off" placeholder="Kingdom of…" onchange={(e) => commit(updateHouse(tree, { realm: e.currentTarget.value }))} />
      </label>

      <fieldset class="options">
        <legend class="eu-label">Succession law</legend>
        <div class="laws">
          {#each laws as law (law)}
            <label class="eu-pill law">
              <input type="radio" name="law" value={law} checked={tree.law === law} onchange={() => commit(updateHouse(tree, { law: law as Law }))} />
              <span class="eu-check"><Icon icon={faCheck} /></span>
              {lawNames[law]}
            </label>
          {/each}
        </div>
        <p class="eu-help">{lawHints[tree.law]} <a href="/guide/#{tree.law}">How it works</a></p>
      </fieldset>

      <fieldset class="options">
        <legend class="eu-label">Left out of the line</legend>
        <div class="eu-row">
          {#each rules as rule (rule.key)}
            <label class="eu-pill">
              <input type="checkbox" checked={tree.exclude[rule.key]} onchange={(e) => setRule(rule.key, e.currentTarget.checked)} />
              <span class="eu-check"><Icon icon={faCheck} /></span>
              {rule.label}
            </label>
          {/each}
        </div>
      </fieldset>

      <label class="eu-field">
        <span class="eu-label">On the throne</span>
        <select class="eu-select" value={tree.reigning ?? ''} onchange={(e) => commit(updateHouse(tree, { reigning: e.currentTarget.value }))}>
          <option value="">Nobody</option>
          {#each tree.people as p (p.id)}
            {#if !isDead(p) || p.id === tree.reigning}
              <option value={p.id}>{displayName(p)}</option>
            {/if}
          {/each}
        </select>
      </label>
      <label class="eu-field">
        <span class="eu-label">The line descends from</span>
        <select class="eu-select" value={tree.founder ?? ''} onchange={(e) => commit(updateHouse(tree, { founder: e.currentTarget.value }))}>
          <option value="">Worked out for you{tree.founder === undefined && succession.founder ? `: ${name(succession.founder)}` : ''}</option>
          {#each tree.people as p (p.id)}
            <option value={p.id}>{displayName(p)}</option>
          {/each}
        </select>
      </label>
    </form>

    <section class="eu-card" aria-labelledby="line-title">
      <h2 id="line-title">Line of succession</h2>
      {#if succession.line.length}
        <ol class="line">
          {#each succession.line as place (place.id)}
            <li class:heir={place.place === 1}>
              <span class="eu-data place">{place.place}</span>
              <span class="who">
                <button type="button" class="link" onclick={() => select(place.id)}>{name(place.id)}</button>
                {#if place.place === 1}<strong class="mark">{tree.law === 'elective' ? 'First choice' : 'Heir'}</strong>{/if}
                {#if tree.law !== 'elective'}<span class="eu-muted claim">{claimText(tree, place, index)}</span>{/if}
              </span>
              {#if tree.law === 'elective'}
                <span class="eu-row moves">
                  <button type="button" class="eu-btn eu-btn--icon" aria-label="Move {name(place.id)} up" disabled={place.place === 1} onclick={() => commit(movePick(tree, place.id, -1))}><Icon icon={faArrowUp} /></button>
                  <button type="button" class="eu-btn eu-btn--icon" aria-label="Move {name(place.id)} down" disabled={place.place === succession.line.length} onclick={() => commit(movePick(tree, place.id, 1))}><Icon icon={faArrowDown} /></button>
                  <button type="button" class="eu-btn eu-btn--icon" aria-label="Take {name(place.id)} off the list" onclick={() => commit(removePick(tree, place.id))}><Icon icon={faXmark} /></button>
                </span>
              {/if}
            </li>
          {/each}
        </ol>
      {:else}
        <p class="eu-muted">{tree.law === 'elective' ? 'Nobody has been chosen yet.' : 'There is no heir: nobody living has a place in the line.'}</p>
      {/if}

      {#if tree.law === 'elective' && unpicked.length}
        <label class="eu-field">
          <span class="eu-label">Add a candidate</span>
          <select
            class="eu-select"
            value=""
            onchange={(e) => {
              if (e.currentTarget.value) commit(addPick(tree, e.currentTarget.value));
              e.currentTarget.value = '';
            }}
          >
            <option value="">Choose…</option>
            {#each unpicked as id (id)}
              <option value={id}>{name(id)}</option>
            {/each}
          </select>
        </label>
      {/if}

      {#if succession.excluded.length}
        <h3>Left out</h3>
        <ul class="out">
          {#each succession.excluded as entry (entry.id)}
            <li><button type="button" class="link" onclick={() => select(entry.id)}>{name(entry.id)}</button>: {reasonText(tree, entry, index)}</li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="eu-card" aria-labelledby="whatif-title">
      <h2 id="whatif-title">What if…</h2>
      {#if living.length}
        <div class="whatif">
          <label class="eu-field">
            <span class="eu-label">Who</span>
            <select class="eu-select" value={eventWho} onchange={(e) => (eventPerson = e.currentTarget.value)}>
              {#each living as id (id)}
                <option value={id}>{name(id)}</option>
              {/each}
            </select>
          </label>
          <label class="eu-field">
            <span class="eu-label">Does what</span>
            <select class="eu-select" bind:value={eventKind}>
              {#each eventKinds as kind (kind)}
                <option value={kind}>{eventNames[kind]}</option>
              {/each}
            </select>
          </label>
        </div>
        {#if outcome}
          <div class="result" aria-live="polite">
            <p class="eu-kicker">Result</p>
            <p class="headline">{outcome.headline}</p>
            {#each outcome.details as detail, i (i)}
              <p class="eu-muted">{detail}</p>
            {/each}
            {#if outcome.after.line.length && (outcome.crownPasses || outcome.moves.length)}
              <p class="eu-muted">
                The line would be: {outcome.after.line
                  .slice(0, 5)
                  .map((place) => `${place.place}. ${name(place.id)}`)
                  .join(', ')}{outcome.after.line.length > 5 ? `, and ${outcome.after.line.length - 5} more` : ''}.
              </p>
            {/if}
          </div>
          {#if outcome.crownPasses || outcome.moves.length}
            <button type="button" class="eu-btn" data-click="bounce" onclick={() => outcome && commit(outcome.tree, outcome.headline)}><Icon icon={faForward} /> Make it happen</button>
          {/if}
        {/if}
      {:else}
        <p class="eu-muted">Nobody living is in the tree, so nothing can happen to anyone.</p>
      {/if}
    </section>
  </div>
</div>

<style>
  .maker {
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
    gap: var(--space-6);
    align-items: start;
  }

  .stage,
  .side,
  .take {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .stage-top {
    justify-content: space-between;
  }

  h2 {
    font: var(--type-subtitle);
  }

  h3 {
    font: var(--type-heading);
  }

  .zoom {
    align-items: end;
  }

  .zoom-field {
    flex: 1 1 200px;
    max-width: 360px;
  }

  .size {
    flex: 0 1 260px;
  }

  .controls {
    gap: var(--space-4);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .laws {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .law {
    justify-content: flex-start;
  }

  .notes,
  .line,
  .out {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .notes {
    gap: var(--space-2);
  }

  .notes li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    color: var(--ink-muted);
  }

  .notes .problem,
  .caution {
    color: var(--caution-text);
  }

  .line li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-2);
    border-top: 1px solid var(--line);
  }

  /* The ring: the heir is marked by the word and by an outline, never by colour alone. */
  .line .heir {
    border: 3px solid var(--accent-text);
    border-radius: var(--radius-md);
  }

  .place {
    min-width: 2ch;
    color: var(--ink-muted);
    text-align: right;
  }

  .who {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-2);
    min-width: 0;
  }

  .mark {
    color: var(--accent-text);
    font: var(--type-kicker);
    letter-spacing: var(--type-kicker-tracking);
    text-transform: uppercase;
  }

  .claim {
    font: var(--type-body-sm);
  }

  .moves {
    flex-wrap: nowrap;
    gap: var(--space-1);
  }

  .whatif {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-3);
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .result p {
    margin: 0;
  }

  .headline {
    font: var(--type-lead);
  }

  /* A name that selects that person: a link in looks, a button in fact. */
  .link {
    min-width: var(--size-target);
    min-height: var(--size-target);
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-weight: 700;
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
  }

  @media (max-width: 900px) {
    .maker {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
