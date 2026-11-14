<script lang="ts">
  /*
   * Everything about one person: who they are, whose child they are, whom they married, and
   * what they have done about the succession. Each field writes a new tree through `commit`
   * when it is left, so a half-typed date never reaches the line of succession.
   */
  import { faBaby, faCheck, faCrown, faRing, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
  import Icon from '@eurth/style/components/Icon.svelte';
  import { addChild, addSpouse, marry, removePerson, removeUnion, setParents, updateHouse, updatePerson, updateUnion } from '../dynasty/edit';
  import { cleanDate, cleanLink, displayName, indexTree, isDead, MAX_LINK, MAX_NAME, MAX_NOTES, MAX_TITLE, type Person, type Tree, type Union } from '../dynasty/model';

  let {
    tree,
    id,
    commit,
    onselect,
    onclose,
  }: {
    tree: Tree;
    id: string;
    /** Takes the changed tree, and a word for the toast when the change deserves one. */
    commit: (next: Tree, said?: string) => void;
    onselect: (id: string | undefined) => void;
    onclose: () => void;
  } = $props();

  const index = $derived(indexTree(tree));
  const person = $derived(index.person.get(id));
  const name = $derived(displayName(person));
  const unions = $derived(index.unions(id));
  const hasParents = $derived(index.parents(id).length > 0);
  const parentsValue = $derived(person?.union !== undefined ? `u:${person.union}` : person?.parent !== undefined ? `p:${person.parent}` : '');
  const others = $derived(tree.people.filter((p) => p.id !== id));
  const couples = $derived(tree.unions.filter((u) => u.a !== id && u.b !== id));

  const DATE_HELP = 'Write a year (1958) or a full date (1958-03-12).';
  let errors = $state<Record<string, string>>({});
  let marryTo = $state('');
  let lastId = '';
  $effect(() => {
    if (id !== lastId) {
      lastId = id;
      errors = {};
      marryTo = '';
    }
  });

  type DateKey = 'born' | 'died' | 'reignFrom' | 'reignTo';
  function setDate(key: DateKey, input: HTMLInputElement) {
    const value = input.value.trim();
    if (value && !cleanDate(value)) {
      errors[key] = DATE_HELP;
      return;
    }
    delete errors[key];
    commit(updatePerson(tree, id, { [key]: cleanDate(value) }));
  }

  function setUnionDate(union: Union, key: 'married' | 'ended', input: HTMLInputElement) {
    const value = input.value.trim();
    const field = `${union.id}-${key}`;
    if (value && !cleanDate(value)) {
      errors[field] = DATE_HELP;
      return;
    }
    delete errors[field];
    commit(updateUnion(tree, union.id, { [key]: cleanDate(value) }));
  }

  function setLink(input: HTMLInputElement) {
    const value = input.value.trim();
    if (value && !cleanLink(value)) {
      errors.link = 'A link starts with https:// and has no spaces.';
      return;
    }
    delete errors.link;
    commit(updatePerson(tree, id, { link: cleanLink(value) }));
  }

  function setParentsFrom(value: string) {
    if (value.startsWith('u:')) commit(setParents(tree, id, { union: value.slice(2) }));
    else if (value.startsWith('p:')) commit(setParents(tree, id, { parent: value.slice(2) }));
    else commit(setParents(tree, id, null));
  }

  function child() {
    const added = addChild(tree, id);
    commit(added.tree, `A child for ${name}.`);
    onselect(added.id);
  }

  function spouse() {
    const added = addSpouse(tree, id);
    commit(added.tree, `${name} is married. Now name the spouse.`);
    onselect(added.id);
  }

  function wed() {
    if (!marryTo) return;
    const added = marry(tree, id, marryTo);
    if (added.id) commit(added.tree, `${name} and ${displayName(index.person.get(marryTo))} are married.`);
    marryTo = '';
  }

  function remove() {
    commit(removePerson(tree, id), `${name} is struck from the record.`);
    onselect(undefined);
  }

  const set = (changes: Partial<Person>) => commit(updatePerson(tree, id, changes));
</script>

{#if person}
  <section class="eu-card editor" aria-labelledby="editor-title">
    <div class="eu-row top">
      <h3 id="editor-title">{name}</h3>
      <button type="button" class="eu-btn eu-btn--icon close" aria-label="Close the editor" data-tip="Close" onclick={onclose}><Icon icon={faXmark} /></button>
    </div>

    <div class="fields">
      <label class="eu-field">
        <span class="eu-label">Name</span>
        <input class="eu-input" value={person.name} maxlength={MAX_NAME} autocomplete="off" onchange={(e) => set({ name: e.currentTarget.value })} />
      </label>
      <label class="eu-field">
        <span class="eu-label">Title</span>
        <input class="eu-input" value={person.title ?? ''} maxlength={MAX_TITLE} autocomplete="off" placeholder="King, Princess, Lord" onchange={(e) => set({ title: e.currentTarget.value })} />
      </label>
      <label class="eu-field">
        <span class="eu-label">Sex</span>
        <select class="eu-select" value={person.sex} onchange={(e) => set({ sex: e.currentTarget.value as Person['sex'] })} aria-describedby="sex-help">
          <option value="x">Not stated</option>
          <option value="f">Female</option>
          <option value="m">Male</option>
        </select>
        <span class="eu-help" id="sex-help">Only laws that tell sons from daughters need it.</span>
      </label>

      <label class="eu-field">
        <span class="eu-label">Born</span>
        <input
          class="eu-input eu-input--data"
          value={person.born ?? ''}
          inputmode="text"
          autocomplete="off"
          placeholder="1958"
          aria-invalid={errors.born ? 'true' : undefined}
          aria-describedby={errors.born ? 'born-error' : undefined}
          onchange={(e) => setDate('born', e.currentTarget)}
        />
        {#if errors.born}<span class="eu-error" id="born-error">{errors.born}</span>{/if}
      </label>
      <label class="eu-field">
        <span class="eu-label">Died</span>
        <input
          class="eu-input eu-input--data"
          value={person.died ?? ''}
          autocomplete="off"
          aria-invalid={errors.died ? 'true' : undefined}
          aria-describedby={errors.died ? 'died-error' : undefined}
          onchange={(e) => setDate('died', e.currentTarget)}
        />
        {#if errors.died}<span class="eu-error" id="died-error">{errors.died}</span>{/if}
      </label>
      <div class="eu-field ticks">
        <span class="eu-label">Alive?</span>
        <label class="eu-pill">
          <input type="checkbox" checked={isDead(person)} disabled={person.died !== undefined} onchange={(e) => set({ dead: e.currentTarget.checked })} />
          <span class="eu-check"><Icon icon={faCheck} /></span>
          Has died
        </label>
      </div>

      <label class="eu-field">
        <span class="eu-label">Reigned from</span>
        <input
          class="eu-input eu-input--data"
          value={person.reignFrom ?? ''}
          autocomplete="off"
          aria-invalid={errors.reignFrom ? 'true' : undefined}
          aria-describedby={errors.reignFrom ? 'reign-from-error' : undefined}
          onchange={(e) => setDate('reignFrom', e.currentTarget)}
        />
        {#if errors.reignFrom}<span class="eu-error" id="reign-from-error">{errors.reignFrom}</span>{/if}
      </label>
      <label class="eu-field">
        <span class="eu-label">Reigned until</span>
        <input
          class="eu-input eu-input--data"
          value={person.reignTo ?? ''}
          autocomplete="off"
          aria-invalid={errors.reignTo ? 'true' : undefined}
          aria-describedby={errors.reignTo ? 'reign-to-error' : undefined}
          onchange={(e) => setDate('reignTo', e.currentTarget)}
        />
        {#if errors.reignTo}<span class="eu-error" id="reign-to-error">{errors.reignTo}</span>{/if}
      </label>
      <label class="eu-field">
        <span class="eu-label">Parents</span>
        <select class="eu-select" value={parentsValue} onchange={(e) => setParentsFrom(e.currentTarget.value)}>
          <option value="">Not in the tree</option>
          {#if couples.length}
            <optgroup label="A couple">
              {#each couples as u (u.id)}
                <option value="u:{u.id}">{displayName(index.person.get(u.a))} and {displayName(index.person.get(u.b))}</option>
              {/each}
            </optgroup>
          {/if}
          <optgroup label="One known parent">
            {#each others as p (p.id)}
              <option value="p:{p.id}">{displayName(p)}</option>
            {/each}
          </optgroup>
        </select>
      </label>
    </div>

    <fieldset class="group">
      <legend class="eu-label">The succession</legend>
      <div class="eu-row">
        {#if hasParents}
          <label class="eu-pill">
            <input type="checkbox" checked={person.adopted === true} onchange={(e) => set({ adopted: e.currentTarget.checked })} />
            <span class="eu-check"><Icon icon={faCheck} /></span>
            Adopted
          </label>
        {/if}
        <label class="eu-pill">
          <input type="checkbox" checked={person.illegitimate === true} onchange={(e) => set({ illegitimate: e.currentTarget.checked })} />
          <span class="eu-check"><Icon icon={faCheck} /></span>
          Born outside marriage
        </label>
        <label class="eu-pill">
          <input type="checkbox" checked={person.abdicated === true} onchange={(e) => set({ abdicated: e.currentTarget.checked })} />
          <span class="eu-check"><Icon icon={faCheck} /></span>
          Abdicated
        </label>
      </div>
      <label class="eu-field renounce">
        <span class="eu-label">Renounced their place</span>
        <select class="eu-select" value={person.renounced ?? ''} onchange={(e) => set({ renounced: (e.currentTarget.value || undefined) as Person['renounced'] })}>
          <option value="">No</option>
          <option value="self">Yes, for themself</option>
          <option value="line">Yes, for themself and their descendants</option>
        </select>
      </label>
    </fieldset>

    <fieldset class="group">
      <legend class="eu-label">Marriages</legend>
      {#each unions as u (u.id)}
        {@const partner = index.person.get(index.partner(u, id))}
        <div class="marriage">
          <p class="who">
            To <button type="button" class="link" onclick={() => onselect(partner?.id)}>{displayName(partner)}</button>
          </p>
          <label class="eu-field">
            <span class="eu-label">Married</span>
            <input
              class="eu-input eu-input--data"
              value={u.married ?? ''}
              autocomplete="off"
              aria-invalid={errors[`${u.id}-married`] ? 'true' : undefined}
              aria-describedby={errors[`${u.id}-married`] ? `${u.id}-married-error` : undefined}
              onchange={(e) => setUnionDate(u, 'married', e.currentTarget)}
            />
            {#if errors[`${u.id}-married`]}<span class="eu-error" id="{u.id}-married-error">{errors[`${u.id}-married`]}</span>{/if}
          </label>
          <label class="eu-field">
            <span class="eu-label">Divorced or annulled</span>
            <input
              class="eu-input eu-input--data"
              value={u.ended ?? ''}
              autocomplete="off"
              aria-invalid={errors[`${u.id}-ended`] ? 'true' : undefined}
              aria-describedby={errors[`${u.id}-ended`] ? `${u.id}-ended-error` : undefined}
              onchange={(e) => setUnionDate(u, 'ended', e.currentTarget)}
            />
            {#if errors[`${u.id}-ended`]}<span class="eu-error" id="{u.id}-ended-error">{errors[`${u.id}-ended`]}</span>{/if}
          </label>
          <label class="eu-pill">
            <input type="checkbox" checked={u.out === true} onchange={(e) => commit(updateUnion(tree, u.id, { out: e.currentTarget.checked }))} />
            <span class="eu-check"><Icon icon={faCheck} /></span>
            A marriage out
          </label>
          <button type="button" class="eu-btn" data-click="swing-left" onclick={() => commit(removeUnion(tree, u.id), 'The marriage is undone. The children stay.')}>
            <Icon icon={faTrashCan} /> Undo the marriage
          </button>
        </div>
      {:else}
        <p class="eu-muted none">None recorded.</p>
      {/each}
      <div class="eu-row">
        <button type="button" class="eu-btn" data-click="bounce" onclick={spouse}><Icon icon={faRing} /> Add a spouse</button>
        {#if others.length}
          <label class="eu-field marry">
            <span class="eu-label">Or marry someone in the tree</span>
            <select class="eu-select" bind:value={marryTo} onchange={wed}>
              <option value="">Choose…</option>
              {#each others as p (p.id)}
                <option value={p.id}>{displayName(p)}</option>
              {/each}
            </select>
          </label>
        {/if}
      </div>
      <p class="eu-help">A marriage out is one the house does not recognise: unequal, unapproved, or into another house.</p>
    </fieldset>

    <label class="eu-field">
      <span class="eu-label">Notes</span>
      <textarea class="eu-textarea" rows="2" maxlength={MAX_NOTES} value={person.notes ?? ''} onchange={(e) => set({ notes: e.currentTarget.value })}></textarea>
    </label>
    <label class="eu-field">
      <span class="eu-label">Link to a wiki page or forum topic</span>
      <input
        class="eu-input"
        type="url"
        value={person.link ?? ''}
        maxlength={MAX_LINK}
        autocomplete="off"
        placeholder="https://"
        aria-invalid={errors.link ? 'true' : undefined}
        aria-describedby={errors.link ? 'link-error' : undefined}
        onchange={(e) => setLink(e.currentTarget)}
      />
      {#if errors.link}<span class="eu-error" id="link-error">{errors.link}</span>{/if}
    </label>

    <div class="eu-row">
      <button type="button" class="eu-btn" data-click="bounce" onclick={child}><Icon icon={faBaby} /> Add a child</button>
      {#if tree.reigning !== id && !isDead(person)}
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => commit(updateHouse(tree, { reigning: id }), `Long live ${name}.`)}>
          <Icon icon={faCrown} /> Put on the throne
        </button>
      {/if}
      <button type="button" class="eu-btn" data-click="swing-left" onclick={remove}><Icon icon={faTrashCan} /> Remove {person.name || 'this person'}</button>
    </div>
  </section>
{/if}

<style>
  .editor {
    gap: var(--space-4);
    border: 1px solid var(--line-strong);
  }

  .top {
    justify-content: space-between;
  }

  h3 {
    font: var(--type-subtitle);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-4);
    align-items: start;
  }

  .ticks {
    align-items: flex-start;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .renounce,
  .marry {
    max-width: 420px;
    flex: 1 1 260px;
  }

  .marriage {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-3);
    align-items: end;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--line);
  }

  .who {
    grid-column: 1 / -1;
    margin: 0;
  }

  .none {
    margin: 0;
  }

  /* A name inside a sentence that selects that person: a link in looks, a button in fact. */
  .link {
    min-height: var(--size-target);
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
