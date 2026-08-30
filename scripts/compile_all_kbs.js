const fs = require('fs');
const path = require('path');
const pdf = require('c:/projetos/medv2/node_modules/pdf-parse');

const kbs = [
    {
        name: 'katia_haranaka',
        dir: "G:/Meu Drive/base de conhecimento Medical/PDF Katia Haranaka",
        output: "c:/projetos/medv2/data/katia_haranaka_kb.json"
    },
    {
        name: 'guilherme_freccia',
        dir: "G:/Meu Drive/base de conhecimento Medical/Guilherme Freccia",
        output: "c:/projetos/medv2/data/guilherme_freccia_kb.json"
    },
    {
        name: 'nutricao',
        dir: "G:/Meu Drive/base de conhecimento Medical/Nutricao",
        output: "c:/projetos/medv2/data/nutricao_kb.json"
    }
];

function parseCard(cardText, fileName) {
    const lines = cardText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return null;

    let title = "";
    let type = "";
    let name = "";
    let tags = [];
    let category = "";
    let tldr = "";
    
    // Find title (first line starting with #)
    const titleIndex = lines.findIndex(l => l.startsWith('#'));
    if (titleIndex !== -1) {
        title = lines[titleIndex].replace('#', '').trim();
        // Remove outer brackets if any: #[Title] or #[Type: Name]
        if (title.startsWith('[') && title.endsWith(']')) {
            title = title.substring(1, title.length - 1).trim();
        }
        const parts = title.split(':');
        if (parts.length > 1) {
            type = parts[0].trim();
            name = parts.slice(1).join(':').trim();
        } else {
            // Also check for [Type] Name or similar
            const bracketMatch = title.match(/^\[(.*?)\]\s*(.*)$/);
            if (bracketMatch) {
                type = bracketMatch[1].trim();
                name = bracketMatch[2].trim();
            } else {
                name = title;
            }
        }
    }

    // Find tags, category, tldr
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Tags:')) {
            const cleanLine = line.replace(/\*|Tags:/g, '').trim();
            tags = cleanLine.split(/\s+/).map(t => t.replace(/[#\[\]]/g, '').trim()).filter(t => t.length > 0);
        }
        if (line.includes('Categoria:')) {
            category = line.replace(/\*|Categoria:/g, '').replace(/[\[\]]/g, '').trim();
        }
        if (line.includes('Resumo (TL;DR):')) {
            tldr = line.replace(/^>\s*\*\*Resumo\s*\(TL;DR\):\*\*/i, '').trim();
            let j = i + 1;
            while (j < lines.length && lines[j].startsWith('>') && !lines[j].includes('Explicação Detalhada') && !lines[j].includes('Aplicação Prática')) {
                tldr += " " + lines[j].replace(/^>/, '').trim();
                j++;
            }
        }
    }

    return {
        fileName,
        title,
        type,
        name,
        tags,
        category,
        tldr,
        rawText: cardText
    };
}

async function compileKb(kb) {
    if (!fs.existsSync(kb.dir)) {
        console.warn(`Directory not found: ${kb.dir}`);
        return;
    }
    const files = fs.readdirSync(kb.dir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    console.log(`[${kb.name}] Processing ${pdfFiles.length} PDF files...`);

    const allCards = [];
    const biomarkerMap = {};

    for (const file of pdfFiles) {
        const filePath = path.join(kb.dir, file);
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const parsed = await pdf(dataBuffer);
            const text = parsed.text;

            // Split into cards using robust divider
            const rawCards = text.split(/\r?\n\s*---\s*\r?\n/);
            
            rawCards.forEach(rawCard => {
                const card = parseCard(rawCard, file);
                if (card && card.title) {
                    allCards.push(card);
                    
                    // Index by tags/keywords
                    card.tags.forEach(tag => {
                        const cleanTag = tag.toLowerCase();
                        if (!biomarkerMap[cleanTag]) {
                            biomarkerMap[cleanTag] = [];
                        }
                        biomarkerMap[cleanTag].push(allCards.length - 1);
                    });
                }
            });
        } catch (e) {
            console.error(`Error reading ${file} in ${kb.name}:`, e);
        }
    }

    const kbData = {
        totalCards: allCards.length,
        cards: allCards,
        index: biomarkerMap,
        extractedAt: new Date().toISOString()
    };

    // Ensure parent directories exist
    fs.mkdirSync(path.dirname(kb.output), { recursive: true });
    fs.writeFileSync(kb.output, JSON.stringify(kbData, null, 2), 'utf8');
    console.log(`[${kb.name}] Successfully wrote ${allCards.length} cards to ${kb.output}`);
}

async function run() {
    for (const kb of kbs) {
        await compileKb(kb);
    }
    console.log("All compilations complete.");
}

run().catch(console.error);
