// Sprite loader and manager
// Pokemon name to National Dex number mapping
const POKEMON_DEX_IDS = {
    bulbasaur: 1,
    ivysaur: 2,
    venusaur: 3,
    charmander: 4,
    charmeleon: 5,
    charizard: 6,
    squirtle: 7,
    wartortle: 8,
    blastoise: 9,
    pidgey: 16,
    pidgeotto: 17,
    sandshrew: 27,
    sandslash: 28,
    pikachu: 25,
    oddish: 43,
    gloom: 44,
    geodude: 74,
    graveler: 75,
    golem: 76,
    gastly: 92,
    haunter: 93,
    onix: 95,
    magikarp: 129,
    gyarados: 130,
    lapras: 131,
    eevee: 133,
    magmar: 126,
    magby: 240,
    glaceon: 471,
    snorunt: 361,
    glalie: 362,
    slugma: 218,
    ralts: 280,
    kirlia: 281
};

const SpriteManager = {
    sprites: {},
    loaded: 0,
    total: 0,

    getSpriteUrl: (pokemonId) => {
        const dexId = POKEMON_DEX_IDS[pokemonId.toLowerCase()];
        if (dexId) {
            return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${dexId}.png`;
        }
        return null;
    },

    loadSprite: (pokemonId) => {
        return new Promise((resolve, reject) => {
            if (SpriteManager.sprites[pokemonId]) {
                resolve(SpriteManager.sprites[pokemonId]);
                return;
            }

            const url = SpriteManager.getSpriteUrl(pokemonId);
            if (!url) {
                SpriteManager.createFallbackSprite(pokemonId);
                resolve(SpriteManager.sprites[pokemonId]);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                SpriteManager.sprites[pokemonId] = img;
                SpriteManager.loaded++;
                resolve(img);
            };
            img.onerror = () => {
                SpriteManager.createFallbackSprite(pokemonId);
                resolve(SpriteManager.sprites[pokemonId]);
            };
            img.src = url;
        });
    },

    createFallbackSprite: (pokemonId) => {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');

        const colors = ['#ff6b35', '#4a90e2', '#78c850', '#98d8d8', '#b8a038'];
        const color = colors[pokemonId.length % colors.length];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(48, 48, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayName = pokemonId.charAt(0).toUpperCase() + pokemonId.slice(1, 6);
        ctx.fillText(displayName, 48, 48);

        SpriteManager.sprites[pokemonId] = canvas;
        SpriteManager.loaded++;
    },

    loadAllSprites: async (pokemonList) => {
        SpriteManager.total = pokemonList.length;
        SpriteManager.loaded = 0;
        const promises = pokemonList.map(id => SpriteManager.loadSprite(id));
        await Promise.all(promises);
    },

    getSprite: (pokemonId) => {
        return SpriteManager.sprites[pokemonId] || null;
    }
};

const POKEMON_SIZES = {
    bulbasaur: 0.6,
    ivysaur: 0.7,
    venusaur: 0.85,
    charmander: 0.6,
    charmeleon: 0.7,
    charizard: 0.9,
    squirtle: 0.6,
    wartortle: 0.7,
    blastoise: 0.85,
    pidgey: 0.5,
    pidgeotto: 0.7,
    sandshrew: 0.55,
    sandslash: 0.75,
    pikachu: 0.55,
    oddish: 0.5,
    gloom: 0.65,
    geodude: 0.5,
    graveler: 0.75,
    golem: 0.8,
    gastly: 0.55,
    haunter: 0.65,
    onix: 0.8,
    magikarp: 0.5,
    gyarados: 1.1,
    lapras: 0.9,
    eevee: 0.55,
    magmar: 0.7,
    magby: 0.5,
    glaceon: 0.65,
    snorunt: 0.55,
    glalie: 0.75,
    slugma: 0.5,
    ralts: 0.5,
    kirlia: 0.6
};
