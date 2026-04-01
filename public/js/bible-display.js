/**
 * B1G Timer - Bible Display (Stage-side renderer)
 * Shows Bible verses on the Stage Display with 40 design presets, transitions, responsive layout
 */

const BibleDisplay = {
    PRESETS: {
        classic: { name:'Classic', desc:'Clean white text on pure black.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#ffffff', bgType:'solid', bgColor:'#000000', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#000000',text:'#ffffff',font:"Georgia, serif"} },
        modern: { name:'Modern', desc:'Cool blue gradient with sans-serif.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#e0e0e0', bgType:'gradient', bgColor:'linear-gradient(135deg, #1a1a2e, #16213e)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1a1a2e, #16213e)',text:'#e0e0e0',font:"Segoe UI, sans-serif"} },
        elegant: { name:'Elegant', desc:'Warm parchment tones with serif.', fontFamily:"'Playfair Display', Georgia, serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#f5e6d3', bgType:'solid', bgColor:'#1a1410', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#1a1410',text:'#f5e6d3',font:"Playfair Display, Georgia, serif"} },
        warm: { name:'Warm', desc:'Rich brown tones, cozy feel.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#fff8f0', bgType:'gradient', bgColor:'linear-gradient(135deg, #3d1f00, #5c2d00)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #3d1f00, #5c2d00)',text:'#fff8f0',font:"Georgia, serif"} },
        cinematic: { name:'Cinematic', desc:'Dark with bold sans-serif type.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'5.5vw', refFontSize:'2vw', textColor:'#ffffff', bgType:'solid', bgColor:'#0a0a0a', textAlign:'center', refPosition:'bottom-right', preview:{bg:'#0a0a0a',text:'#ffffff',font:"Segoe UI, sans-serif"} },
        minimal: { name:'Minimal', desc:'Subtle grey on dark, understated.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'3.5vw', refFontSize:'1.8vw', textColor:'#cccccc', bgType:'solid', bgColor:'#111111', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#111111',text:'#cccccc',font:"Segoe UI, sans-serif"} },
        bold: { name:'Bold', desc:'Gold letters on deep purple.', fontFamily:"'Arial Black', 'Impact', sans-serif", fontSize:'6vw', refFontSize:'2.5vw', textColor:'#ffd700', bgType:'solid', bgColor:'#1a0a2e', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#1a0a2e',text:'#ffd700',font:"Arial Black, sans-serif"} },
        nature: { name:'Nature', desc:'Earthy green tones.', fontFamily:"'Georgia', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#e8f5e9', bgType:'gradient', bgColor:'linear-gradient(135deg, #0d1f0d, #1a3a1a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #0d1f0d, #1a3a1a)',text:'#e8f5e9',font:"Georgia, serif"} },
        ocean: { name:'Ocean', desc:'Deep sea blues with light text.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#b3e5fc', bgType:'gradient', bgColor:'linear-gradient(135deg, #001f3f, #003366)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #001f3f, #003366)',text:'#b3e5fc',font:"Segoe UI, sans-serif"} },
        sunset: { name:'Sunset', desc:'Purple to orange warm gradient.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#fff5e1', bgType:'gradient', bgColor:'linear-gradient(135deg, #4a1942, #c84b31)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #4a1942, #c84b31)',text:'#fff5e1',font:"Georgia, serif"} },
        // 30 additional designs
        midnight: { name:'Midnight', desc:'Deep navy with silver text.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#c0c0c0', bgType:'gradient', bgColor:'linear-gradient(135deg, #0a0e27, #141e3d)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #0a0e27, #141e3d)',text:'#c0c0c0',font:"Georgia, serif"} },
        royal: { name:'Royal', desc:'Regal purple with gold accents.', fontFamily:"'Playfair Display', Georgia, serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#f0d060', bgType:'gradient', bgColor:'linear-gradient(135deg, #2d1050, #4a1a6b)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #2d1050, #4a1a6b)',text:'#f0d060',font:"Playfair Display, Georgia, serif"} },
        ember: { name:'Ember', desc:'Fiery red-orange glow.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#ffe0b2', bgType:'gradient', bgColor:'linear-gradient(135deg, #3e0000, #8b1a1a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #3e0000, #8b1a1a)',text:'#ffe0b2',font:"Georgia, serif"} },
        frost: { name:'Frost', desc:'Icy cool blues and whites.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#e3f2fd', bgType:'gradient', bgColor:'linear-gradient(135deg, #0d2137, #1a3a5c)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #0d2137, #1a3a5c)',text:'#e3f2fd',font:"Segoe UI, sans-serif"} },
        parchment: { name:'Parchment', desc:'Old scroll look, warm tones.', fontFamily:"'Palatino Linotype', 'Book Antiqua', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#3e2723', bgType:'solid', bgColor:'#f5e6c8', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#f5e6c8',text:'#3e2723',font:"Palatino Linotype, serif"} },
        neon: { name:'Neon', desc:'Bright cyan on dark.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#00ffcc', bgType:'solid', bgColor:'#0a0a1a', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#0a0a1a',text:'#00ffcc',font:"Segoe UI, sans-serif"} },
        rose: { name:'Rose', desc:'Soft pink romantic tones.', fontFamily:"'Georgia', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#fce4ec', bgType:'gradient', bgColor:'linear-gradient(135deg, #3a0a1a, #5c1a2a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #3a0a1a, #5c1a2a)',text:'#fce4ec',font:"Georgia, serif"} },
        forest: { name:'Forest', desc:'Deep woodland greens.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#c8e6c9', bgType:'gradient', bgColor:'linear-gradient(135deg, #1b2a1b, #2e4a2e)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1b2a1b, #2e4a2e)',text:'#c8e6c9',font:"Georgia, serif"} },
        slate: { name:'Slate', desc:'Cool grey stone look.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#eceff1', bgType:'gradient', bgColor:'linear-gradient(135deg, #263238, #37474f)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #263238, #37474f)',text:'#eceff1',font:"Segoe UI, sans-serif"} },
        aurora: { name:'Aurora', desc:'Northern lights purple-green.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#e0f7fa', bgType:'gradient', bgColor:'linear-gradient(135deg, #1a0033, #004d40)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1a0033, #004d40)',text:'#e0f7fa',font:"Segoe UI, sans-serif"} },
        cream: { name:'Cream', desc:'Soft warm white on dark brown.', fontFamily:"'Palatino Linotype', 'Book Antiqua', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#fff8e1', bgType:'solid', bgColor:'#2c1a0e', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#2c1a0e',text:'#fff8e1',font:"Palatino Linotype, serif"} },
        steel: { name:'Steel', desc:'Industrial blue-grey.', fontFamily:"'Arial Black', sans-serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#b0bec5', bgType:'gradient', bgColor:'linear-gradient(135deg, #1a1a2e, #2c3e50)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1a1a2e, #2c3e50)',text:'#b0bec5',font:"Arial Black, sans-serif"} },
        lavender: { name:'Lavender', desc:'Soft purple pastel.', fontFamily:"'Georgia', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#f3e5f5', bgType:'gradient', bgColor:'linear-gradient(135deg, #1a0a2e, #311b52)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1a0a2e, #311b52)',text:'#f3e5f5',font:"Georgia, serif"} },
        sandstone: { name:'Sandstone', desc:'Desert warm tan tones.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#fff3e0', bgType:'gradient', bgColor:'linear-gradient(135deg, #3e2723, #5d4037)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #3e2723, #5d4037)',text:'#fff3e0',font:"Georgia, serif"} },
        ink: { name:'Ink', desc:'Pure white on jet black, high contrast.', fontFamily:"'Courier New', monospace", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#ffffff', bgType:'solid', bgColor:'#000000', textAlign:'left', refPosition:'bottom-right', preview:{bg:'#000000',text:'#ffffff',font:"Courier New, monospace"} },
        dawn: { name:'Dawn', desc:'Gentle morning sky gradient.', fontFamily:"'Georgia', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#ffffff', bgType:'gradient', bgColor:'linear-gradient(180deg, #1a1a3e, #4a2860, #c84b31)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(180deg, #1a1a3e, #4a2860, #c84b31)',text:'#ffffff',font:"Georgia, serif"} },
        ivory: { name:'Ivory', desc:'Light elegant, dark text on light bg.', fontFamily:"'Playfair Display', Georgia, serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#1a1a1a', bgType:'solid', bgColor:'#faf8f0', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#faf8f0',text:'#1a1a1a',font:"Playfair Display, Georgia, serif"} },
        nebula: { name:'Nebula', desc:'Cosmic deep space gradient.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#e1bee7', bgType:'gradient', bgColor:'linear-gradient(135deg, #0d0020, #1a0040, #003355)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #0d0020, #1a0040, #003355)',text:'#e1bee7',font:"Segoe UI, sans-serif"} },
        copper: { name:'Copper', desc:'Metallic warm copper tones.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#ffccbc', bgType:'gradient', bgColor:'linear-gradient(135deg, #1a0e0a, #4a2a1a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1a0e0a, #4a2a1a)',text:'#ffccbc',font:"Georgia, serif"} },
        arctic: { name:'Arctic', desc:'Crisp white-blue tones.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#ffffff', bgType:'gradient', bgColor:'linear-gradient(135deg, #0d1b2a, #1b3a4b)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #0d1b2a, #1b3a4b)',text:'#ffffff',font:"Segoe UI, sans-serif"} },
        wine: { name:'Wine', desc:'Deep burgundy richness.', fontFamily:"'Palatino Linotype', 'Book Antiqua', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#f8bbd0', bgType:'gradient', bgColor:'linear-gradient(135deg, #2a0a1a, #4a0e2a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #2a0a1a, #4a0e2a)',text:'#f8bbd0',font:"Palatino Linotype, serif"} },
        charcoal: { name:'Charcoal', desc:'Dark slate with soft grey text.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#bdbdbd', bgType:'solid', bgColor:'#1c1c1c', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#1c1c1c',text:'#bdbdbd',font:"Segoe UI, sans-serif"} },
        olive: { name:'Olive', desc:'Warm olive green.', fontFamily:"'Georgia', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#dcedc8', bgType:'gradient', bgColor:'linear-gradient(135deg, #1a1f0e, #33402a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1a1f0e, #33402a)',text:'#dcedc8',font:"Georgia, serif"} },
        velvet: { name:'Velvet', desc:'Rich dark magenta.', fontFamily:"'Playfair Display', Georgia, serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#f8e0ff', bgType:'gradient', bgColor:'linear-gradient(135deg, #200020, #3a0040)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #200020, #3a0040)',text:'#f8e0ff',font:"Playfair Display, Georgia, serif"} },
        pearl: { name:'Pearl', desc:'Soft white shimmer on dark.', fontFamily:"'Georgia', serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#fafafa', bgType:'gradient', bgColor:'linear-gradient(135deg, #1a1a1a, #2a2a3a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #1a1a1a, #2a2a3a)',text:'#fafafa',font:"Georgia, serif"} },
        golden: { name:'Golden', desc:'Bright gold on deep black.', fontFamily:"'Arial Black', sans-serif", fontSize:'5.5vw', refFontSize:'2.5vw', textColor:'#ffc107', bgType:'solid', bgColor:'#0a0800', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#0a0800',text:'#ffc107',font:"Arial Black, sans-serif"} },
        sapphire: { name:'Sapphire', desc:'Brilliant deep blue.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#bbdefb', bgType:'gradient', bgColor:'linear-gradient(135deg, #0a0a40, #0d2080)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #0a0a40, #0d2080)',text:'#bbdefb',font:"Georgia, serif"} },
        ash: { name:'Ash', desc:'Muted grey neutral.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4vw', refFontSize:'2vw', textColor:'#e0e0e0', bgType:'solid', bgColor:'#212121', textAlign:'center', refPosition:'bottom-center', preview:{bg:'#212121',text:'#e0e0e0',font:"Segoe UI, sans-serif"} },
        terra: { name:'Terra', desc:'Earthy terracotta.', fontFamily:"'Georgia', serif", fontSize:'5vw', refFontSize:'2.5vw', textColor:'#ffecb3', bgType:'gradient', bgColor:'linear-gradient(135deg, #2a1a0a, #5c3a1a)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(135deg, #2a1a0a, #5c3a1a)',text:'#ffecb3',font:"Georgia, serif"} },
        cloud: { name:'Cloud', desc:'Light grey with dark text.', fontFamily:"'Segoe UI', -apple-system, sans-serif", fontSize:'4.5vw', refFontSize:'2vw', textColor:'#333333', bgType:'gradient', bgColor:'linear-gradient(180deg, #e8e8e8, #d0d0d0)', textAlign:'center', refPosition:'bottom-center', preview:{bg:'linear-gradient(180deg, #e8e8e8, #d0d0d0)',text:'#333333',font:"Segoe UI, sans-serif"} },
    },

    TRANSITIONS: {
        none:       { name:'None (Instant)', desc:'Immediate switch, no animation.', icon:'fa-bolt' },
        fade:       { name:'Fade', desc:'Smooth opacity fade between verses.', icon:'fa-circle-half-stroke' },
        'slide-up':   { name:'Slide Up', desc:'New verse slides up from bottom.', icon:'fa-arrow-up' },
        'slide-down': { name:'Slide Down', desc:'New verse slides down from top.', icon:'fa-arrow-down' },
        'slide-left':  { name:'Slide Left', desc:'Verse slides in from right.', icon:'fa-arrow-left' },
        'slide-right': { name:'Slide Right', desc:'Verse slides in from left.', icon:'fa-arrow-right' },
        'zoom-in':     { name:'Zoom In', desc:'Verse zooms in from center.', icon:'fa-expand' },
        'zoom-out':    { name:'Zoom Out', desc:'Verse zooms out from enlarged.', icon:'fa-compress' },
        'flip':        { name:'Flip', desc:'3D flip card effect.', icon:'fa-rotate' },
        'blur':        { name:'Blur', desc:'Blurs out then in.', icon:'fa-eye-slash' },
        'typewriter':  { name:'Typewriter', desc:'Text appears letter by letter.', icon:'fa-keyboard' },
        'scale-fade':  { name:'Scale Fade', desc:'Scale up while fading in.', icon:'fa-up-right-and-down-left-from-center' },
    },

    _currentTransition: 'fade',

    displayVerseOnStage(data) {
        const container = document.getElementById('bible-display');
        const textWrapper = document.getElementById('bible-text-wrapper');
        const verseText = document.getElementById('bible-verse-text');
        const referenceEl = document.getElementById('bible-reference');
        if (!container || !verseText || !referenceEl) return;

        // If no text wrapper exists (old stage), fall back to container
        const animTarget = textWrapper || container;

        const style = data.style || {};
        const transition = style.transition || this._currentTransition || 'fade';
        this._currentTransition = transition;
        const isCurrentlyVisible = container.classList.contains('visible');

        const applyNewContent = () => {
            verseText.textContent = data.text || '';
            const ref = this._formatRef(data);
            referenceEl.textContent = ref;

            const preset = style.preset ? this.PRESETS[style.preset] : null;
            const effective = preset ? { ...preset, ...style } : { ...this.PRESETS.classic, ...style };
            this._applyStyle(container, verseText, referenceEl, effective);

            // Container stays visible (background is static), transitions on text wrapper only
            container.classList.add('visible');

            // Remove transition classes from text wrapper
            animTarget.className = animTarget.className.replace(/\btransition-[\w-]+\b/g, '').trim();

            // Apply entrance animation to TEXT only
            if (transition === 'none') {
                // no animation
            } else if (transition === 'typewriter') {
                this._typewriterEffect(verseText, data.text || '');
            } else {
                const animClass = 'transition-' + transition + '-in';
                animTarget.classList.add(animClass);
                setTimeout(() => animTarget.classList.remove(animClass), 600);
            }

            console.log('[BibleDisplay] Verse displayed:', ref, '(transition:', transition + ')');
        };

        if (isCurrentlyVisible && transition !== 'none') {
            // Transition out the TEXT only, background stays
            animTarget.classList.add('transition-out');
            setTimeout(() => {
                animTarget.classList.remove('transition-out');
                applyNewContent();
            }, 250);
        } else {
            applyNewContent();
        }
    },

    /**
     * Clear only the text from stage, keep background/design
     */
    clearVerseOnStage() {
        const container = document.getElementById('bible-display');
        const textWrapper = document.getElementById('bible-text-wrapper');
        const verseText = document.getElementById('bible-verse-text');
        const referenceEl = document.getElementById('bible-reference');
        if (!container) return;

        const animTarget = textWrapper || container;

        if (container.classList.contains('visible')) {
            // Fade out TEXT only, background stays
            animTarget.classList.add('transition-out');
            setTimeout(() => {
                animTarget.classList.remove('transition-out');
                if (verseText) verseText.textContent = '';
                if (referenceEl) referenceEl.textContent = '';
                // Keep 'visible' class so background stays, but text is gone
                console.log('[BibleDisplay] Verse text cleared (background preserved)');
            }, 250);
        }
    },

    _typewriterEffect(el, text) {
        el.textContent = '';
        let i = 0;
        const timer = setInterval(() => {
            if (i < text.length) {
                el.textContent += text[i];
                i++;
            } else {
                clearInterval(timer);
            }
        }, 30);
    },

    _applyStyle(container, verseText, referenceEl, style) {
        const wasVisible = container.classList.contains('visible');
        const transClasses = [];
        container.classList.forEach(c => { if (c.startsWith('transition-')) transClasses.push(c); });
        container.className = 'bible-display';
        if (wasVisible) container.classList.add('visible');
        transClasses.forEach(c => container.classList.add(c));

        // Responsive font sizing using clamp
        const baseSize = parseFloat(style.fontSize) || 5;
        const refBaseSize = parseFloat(style.refFontSize) || 2.5;
        verseText.style.fontFamily = style.fontFamily || "'Georgia', serif";
        verseText.style.fontSize = `clamp(16px, ${baseSize}vw, 80px)`;
        verseText.style.color = style.textColor || '#ffffff';
        verseText.style.textAlign = style.textAlign || 'center';
        verseText.style.lineHeight = '1.5';
        verseText.style.maxWidth = '90vw';
        verseText.style.wordBreak = 'break-word';

        referenceEl.style.fontFamily = style.fontFamily || "'Georgia', serif";
        referenceEl.style.fontSize = `clamp(10px, ${refBaseSize}vw, 40px)`;
        referenceEl.style.color = style.textColor || '#ffffff';
        referenceEl.style.opacity = '0.75';

        // Reset all background inline styles before applying new ones
        // (prevents residue from previous bgType from bleeding through)
        container.style.background = '';
        container.style.backgroundColor = '';
        container.style.backgroundImage = '';
        container.style.backgroundSize = '';
        container.style.backgroundPosition = '';

        const bgType = style.bgType || 'solid';
        if (bgType === 'image' && style.bgImage) {
            container.classList.add('bible-bg-image');
            container.style.backgroundImage = `url(${style.bgImage})`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
        } else if (bgType === 'gradient') {
            container.style.background = style.bgColor || 'linear-gradient(135deg, #1a1a2e, #16213e)';
        } else {
            container.style.backgroundColor = style.bgColor || '#000000';
        }

        const refPos = style.refPosition || 'bottom-center';
        container.classList.add('bible-ref-' + refPos);

        if (style.textAlign === 'left') container.classList.add('bible-align-left');
        else if (style.textAlign === 'right') container.classList.add('bible-align-right');
    },

    _formatRef(data) {
        let ref = data.book || '';
        if (data.chapter) ref += ' ' + data.chapter;
        if (data.verse) {
            ref += ':' + data.verse;
            if (data.verseEnd && data.verseEnd !== data.verse) ref += '-' + data.verseEnd;
        }
        if (data.version) ref += ' (' + data.version + ')';
        return ref;
    }
};
