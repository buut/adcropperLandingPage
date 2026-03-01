/**
 * Converts a structured stage report string back into a natural language request.
 * Useful for generating fine-tuning datasets where the model learns to map 
 * natural language to structured operations.
 */
export function convertReportToRequest(report: string): string {
    const lines = report.split('\n').map(l => l.trim());

    const stageMatch = report.match(/Stage: (.*?)\. Size: (\d+)x(\d+)px\. Duration: (\d+(?:\.\d+)?)s\./);
    if (!stageMatch) return "";

    const [_, name, width, height, duration] = stageMatch;
    const durationText = duration.endsWith('.0') ? duration.slice(0, -2) : duration;
    let request = `${durationText}s ${width}x${height} ad. `;

    const layers: Record<string, { type: string, anims: string[], spatial?: string }> = {};
    let currentSection = "";

    for (const line of lines) {
        if (line.startsWith("Layers (type and order):")) { currentSection = "layers"; continue; }
        if (line.startsWith("Animations (phase: entry, main, or exit):")) { currentSection = "animations"; continue; }
        if (line === "" || line.startsWith("Actions performed:")) { currentSection = ""; continue; }

        if (currentSection === "layers") {
            // Match shorthand: 1. image: Logo [120x60 at 20,20]
            const match = line.match(/^\d+\.\s+(\w+):\s+(.*?)\s+\[(.*?)\]$/);
            if (match) {
                const [_, type, layerName, spatial] = match;
                layers[layerName.trim()] = { type, anims: [], spatial };
            }
        }

        if (currentSection === "animations") {
            const match = line.match(/-\s+(.*?):\s+(.*?)\s+on layer\s+"(.*?)"\s+at\s+([\d.]+)s/);
            if (match) {
                const [_, phase, animName, layerName] = match;
                const cleanPhase = phase.replace('Text ', '');
                if (layers[layerName]) {
                    layers[layerName].anims.push(`${cleanPhase}:${animName}`);
                } else {
                    const keys = Object.keys(layers);
                    const matchingKey = keys.find(k => layerName.endsWith(k) || k.endsWith(layerName));
                    if (matchingKey) layers[matchingKey].anims.push(`${cleanPhase}:${animName}`);
                }
            }
        }
    }

    const storyParts: string[] = [];

    for (const [layerName, data] of Object.entries(layers)) {
        const type = data.type === 'media' ? 'image' : data.type;
        const base = `${type} "${layerName}" [${data.spatial}]`;
        
        if (data.anims.length === 0) {
            storyParts.push(`Add ${base}`);
        } else {
            const anims = data.anims.map(a => a.split(':')[1].replace(/-/g, ' ')).join(', ');
            storyParts.push(`Add ${base} with ${anims}`);
        }
    }

    request += storyParts.join('. ') + '.';
    return request.trim().replace(/\s{2,}/g, ' ');
}



