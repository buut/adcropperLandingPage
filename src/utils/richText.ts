/**
 * Unified Surgical Rich Text Styling Utility.
 * Uses the Highlight Marker Strategy to apply styles to current browser selection
 * without destroying existing spans or browser anomalies.
 */
export const applyRichTextFormat = (editorId: string, command: string, value: any, preservedRange?: Range | null) => {
    const editor = document.getElementById(editorId);
    if (!editor) {
        console.warn(`[richText] Editor #${editorId} not found.`);
        return;
    }

    const surgicalProps = ['fontSize', 'fontName', 'fontWeight', 'fontStyle', 'foreColor', 'letterSpacing', 'lineHeight', 'textTransform', 'underline', 'overline', 'strikethrough'];
    
    try {
        // Restore range if provided (prevents loss of selection during side-panel interaction)
        if (preservedRange) {
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(preservedRange);
            }
        }

        // Force browser to generate CSS styles instead of <font> tags etc.
        document.execCommand('styleWithCSS', false, 'true');
        
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        
        const range = sel.getRangeAt(0);
        const isCollapsed = range.collapsed;

        if (isCollapsed) {
            // For collapsed selection, we map our commands to browser native actions where they make sense.
            // These will affect characters typed in that position next.
            if (command === 'foreColor') document.execCommand('foreColor', false, value);
            else if (command === 'fontName') document.execCommand('fontName', false, value);
            else if (command === 'fontWeight' && (value === 'bold' || parseInt(value) >= 600)) document.execCommand('bold', false);
            else if (command === 'fontStyle' && value === 'italic') document.execCommand('italic', false);
            else if (command === 'underline') document.execCommand('underline', false);
            else if (command === 'strikethrough') document.execCommand('strikeThrough', false);
        } else if (surgicalProps.includes(command)) {
            // Marker Strategy (Highlight)
            // We use an obscure background color to tag the newly wrapped nodes from execCommand.
            const markerColorHex = '#abcdef';
            const markerColorRgb = 'rgb(171, 205, 239)';
            
            document.execCommand('hiliteColor', false, markerColorHex);
            
            // Query markers within the editor specifically
            const markers = editor.querySelectorAll(`*[style*="background-color"]`);

            markers.forEach(el => {
                const htmlEl = el as HTMLElement;
                const bgColor = htmlEl.style.backgroundColor.replace(/\s/g, '');
                const isMarker = bgColor.includes('171,205,239') || 
                                bgColor.includes('#abcdef') || 
                                bgColor.includes('rgb(171,205,239)');
                
                if (isMarker) {
                    // 1. Clean the marker immediately
                    htmlEl.style.backgroundColor = '';
                    
                    // 2. Apply Target Style
                    switch (command) {
                        case 'fontSize':
                            if (value) htmlEl.style.fontSize = (typeof value === 'number' || /^\d+$/.test(String(value))) ? value + 'px' : value;
                            break;
                        case 'fontName':
                            if (value) htmlEl.style.fontFamily = value;
                            break;
                        case 'fontWeight':
                            if (value) htmlEl.style.fontWeight = value;
                            break;
                        case 'fontStyle':
                            if (value) htmlEl.style.fontStyle = value;
                            break;
                        case 'foreColor':
                            if (value) {
                                if (String(value).includes('gradient')) {
                                    htmlEl.style.backgroundImage = value;
                                    htmlEl.style.webkitBackgroundClip = 'text';
                                    (htmlEl.style as any).webkitTextFillColor = 'transparent';
                                    htmlEl.style.color = 'transparent';
                                    htmlEl.style.display = 'inline-block';
                                } else {
                                    htmlEl.style.color = value;
                                    htmlEl.style.backgroundImage = '';
                                    htmlEl.style.webkitBackgroundClip = '';
                                    (htmlEl.style as any).webkitTextFillColor = '';
                                    htmlEl.style.display = '';
                                }
                            }
                            break;
                        case 'letterSpacing':
                            if (value !== undefined) htmlEl.style.letterSpacing = value + 'px';
                            break;
                        case 'textTransform':
                            if (value) htmlEl.style.textTransform = value;
                            break;
                        case 'lineHeight':
                            if (value) {
                                const num = parseFloat(value);
                                htmlEl.style.lineHeight = (!isNaN(num) && num > 5 && !String(value).includes('px') && !String(value).includes('%')) ? value + 'px' : value;
                            }
                            break;
                        case 'underline':
                        case 'overline':
                        case 'strikethrough': {
                            const current = htmlEl.style.textDecoration || '';
                            const target = command === 'strikethrough' ? 'line-through' : command;
                            if (current.includes(target)) {
                                htmlEl.style.textDecoration = current.replace(target, '').trim() || 'none';
                            } else {
                                htmlEl.style.textDecoration = (current === 'none' || current === 'normal' ? target : current + ' ' + target).trim();
                            }
                            break;
                        }
                    }

                    // 3. Clear Descendant Conflicting Styles
                    // This prevents having red text inside a block we just made blue, etc.
                    const children = htmlEl.getElementsByTagName('*');
                    for (let i = 0; i < children.length; i++) {
                        const child = children[i] as HTMLElement;
                        if (command === 'fontSize') { child.style.fontSize = ''; if (child.hasAttribute('size')) child.removeAttribute('size'); }
                        if (command === 'fontName') { child.style.fontFamily = ''; if (child.hasAttribute('face')) child.removeAttribute('face'); }
                        if (command === 'fontWeight') child.style.fontWeight = '';
                        if (command === 'fontStyle') child.style.fontStyle = '';
                        if (command === 'foreColor') { 
                            child.style.color = ''; 
                            child.style.backgroundImage = '';
                            child.style.webkitBackgroundClip = '';
                            (child.style as any).webkitTextFillColor = '';
                            if (child.hasAttribute('color')) child.removeAttribute('color'); 
                        }
                        if (command === 'letterSpacing') child.style.letterSpacing = '';
                        if (command === 'lineHeight') child.style.lineHeight = '';
                    }
                }
            });
        } else {
            // Final fallback for simple toggles
            document.execCommand(command, false, value);
        }
    } catch (e) {
        console.error('[richText] Formatting failed:', e);
    }
};
