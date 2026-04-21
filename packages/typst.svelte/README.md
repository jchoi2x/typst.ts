## Installation

```bash
bun add @jchoi2x/typst.svelte
```

## Usage
```svelte
<script lang="ts">
    import Typst from "@jchoi2x/typst.svelte"

	const mainContent = `
                = Hello Typst
        `;
</script>

<Typst {mainContent}></Typst>
```
