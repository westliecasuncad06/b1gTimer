/**
 * B1G Timer - Bible Style Manager
 * Manages style presets and live customization for Bible verse display
 */

const BibleStyleManager = {
    _currentStyle: {
        preset: 'classic',
        fontFamily: "'Georgia', serif",
        fontSize: '5vw',
        refFontSize: '2.5vw',
        textColor: '#ffffff',
        bgType: 'solid',
        bgColor: '#000000',
        textAlign: 'center',
        refPosition: 'bottom-center'
    },

    PRESETS: {
        classic: {
            name: 'Classic',
            description: 'White on Black, serif font',
            fontFamily: "'Georgia', serif",
            fontSize: '5vw',
            refFontSize: '2.5vw',
            textColor: '#ffffff',
            bgType: 'solid',
            bgColor: '#000000',
            textAlign: 'center',
            refPosition: 'bottom-center'
        },
        modern: {
            name: 'Modern',
            description: 'Minimalist with gradient',
            fontFamily: "'Segoe UI', -apple-system, sans-serif",
            fontSize: '4.5vw',
            refFontSize: '2vw',
            textColor: '#e0e0e0',
            bgType: 'gradient',
            bgColor: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            textAlign: 'center',
            refPosition: 'bottom-center'
        },
        'lower-third': {
            name: 'Lower Third',
            description: 'For overlaying on video',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: '3vw',
            refFontSize: '1.8vw',
            textColor: '#ffffff',
            bgType: 'lower-third',
            bgColor: 'rgba(0,0,0,0.75)',
            textAlign: 'left',
            refPosition: 'inline-right'
        }
    },

    /**
     * Initialize style panel event listeners
     */
    init() {
        // Preset buttons
        document.querySelectorAll('.bible-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                if (preset && this.PRESETS[preset]) {
                    this.applyPreset(preset);
                }
            });
        });

        // Custom controls
        const fontFamily = document.getElementById('bible-font-family');
        const fontSize = document.getElementById('bible-font-size');
        const textColor = document.getElementById('bible-text-color');
        const bgType = document.getElementById('bible-bg-type');
        const bgColor = document.getElementById('bible-bg-color');
        const textAlign = document.getElementById('bible-text-align');
        const refPosition = document.getElementById('bible-ref-position');

        if (fontFamily) fontFamily.addEventListener('change', () => this._updateFromControls());
        if (fontSize) fontSize.addEventListener('change', () => this._updateFromControls());
        if (textColor) textColor.addEventListener('input', () => this._updateFromControls());
        if (bgType) bgType.addEventListener('change', () => this._updateFromControls());
        if (bgColor) bgColor.addEventListener('input', () => this._updateFromControls());
        if (textAlign) textAlign.addEventListener('change', () => this._updateFromControls());
        if (refPosition) refPosition.addEventListener('change', () => this._updateFromControls());

        // Restore from localStorage
        const saved = localStorage.getItem('b1g_bible_style');
        if (saved) {
            try {
                this._currentStyle = JSON.parse(saved);
                this._syncControlsFromStyle();
            } catch (e) { /* ignore */ }
        }

        // Toggle the style panel
        const toggleBtn = document.getElementById('bible-style-toggle');
        const stylePanel = document.getElementById('bible-style-panel');
        if (toggleBtn && stylePanel) {
            toggleBtn.addEventListener('click', () => {
                stylePanel.classList.toggle('expanded');
                toggleBtn.classList.toggle('active');
            });
        }

        console.log('[BibleStyleManager] Initialized');
    },

    /**
     * Apply a named preset
     */
    applyPreset(presetName) {
        const preset = this.PRESETS[presetName];
        if (!preset) return;

        this._currentStyle = { ...preset, preset: presetName };
        this._syncControlsFromStyle();
        this._save();

        // Update preset button active state
        document.querySelectorAll('.bible-preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });
    },

    /**
     * Read values from form controls
     */
    _updateFromControls() {
        const fontFamily = document.getElementById('bible-font-family');
        const fontSize = document.getElementById('bible-font-size');
        const textColor = document.getElementById('bible-text-color');
        const bgType = document.getElementById('bible-bg-type');
        const bgColor = document.getElementById('bible-bg-color');
        const textAlign = document.getElementById('bible-text-align');
        const refPosition = document.getElementById('bible-ref-position');

        const fontSizeMap = { small: '3vw', normal: '4vw', large: '5vw', xlarge: '6.5vw' };
        const refSizeMap = { small: '1.5vw', normal: '2vw', large: '2.5vw', xlarge: '3vw' };
        const sizeVal = fontSize ? fontSize.value : 'large';

        this._currentStyle = {
            preset: 'custom',
            fontFamily: fontFamily ? fontFamily.value : "'Georgia', serif",
            fontSize: fontSizeMap[sizeVal] || '5vw',
            refFontSize: refSizeMap[sizeVal] || '2.5vw',
            textColor: textColor ? textColor.value : '#ffffff',
            bgType: bgType ? bgType.value : 'solid',
            bgColor: bgColor ? bgColor.value : '#000000',
            textAlign: textAlign ? textAlign.value : 'center',
            refPosition: refPosition ? refPosition.value : 'bottom-center'
        };

        // Mark no preset as active
        document.querySelectorAll('.bible-preset-btn').forEach(btn => btn.classList.remove('active'));
        this._save();
    },

    /**
     * Sync form controls to match current style
     */
    _syncControlsFromStyle() {
        const s = this._currentStyle;

        const fontFamily = document.getElementById('bible-font-family');
        const fontSize = document.getElementById('bible-font-size');
        const textColor = document.getElementById('bible-text-color');
        const bgType = document.getElementById('bible-bg-type');
        const bgColor = document.getElementById('bible-bg-color');
        const textAlign = document.getElementById('bible-text-align');
        const refPosition = document.getElementById('bible-ref-position');

        if (fontFamily) fontFamily.value = s.fontFamily || "'Georgia', serif";
        if (textColor) textColor.value = s.textColor || '#ffffff';
        if (bgColor) bgColor.value = (s.bgType === 'solid' && s.bgColor) ? s.bgColor : '#000000';
        if (bgType) bgType.value = s.bgType || 'solid';
        if (textAlign) textAlign.value = s.textAlign || 'center';
        if (refPosition) refPosition.value = s.refPosition || 'bottom-center';

        // Reverse map fontSize vw → select value
        if (fontSize) {
            const vw = parseFloat(s.fontSize);
            if (vw <= 3) fontSize.value = 'small';
            else if (vw <= 4) fontSize.value = 'normal';
            else if (vw <= 5) fontSize.value = 'large';
            else fontSize.value = 'xlarge';
        }

        // Update preset button active state
        document.querySelectorAll('.bible-preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === s.preset);
        });
    },

    /**
     * Get current style object (to include in broadcast payload)
     */
    getStyle() {
        return { ...this._currentStyle };
    },

    _save() {
        try {
            localStorage.setItem('b1g_bible_style', JSON.stringify(this._currentStyle));
        } catch (e) { /* ignore */ }
    }
};

window.BibleStyleManager = BibleStyleManager;
