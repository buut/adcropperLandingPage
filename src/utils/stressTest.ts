export const generateStressTestData = () => {
    const adSizes = [
        { w: 300, h: 250 }, { w: 728, h: 90 }, { w: 160, h: 600 },
        { w: 1080, h: 1080 }, { w: 1080, h: 1920 }, { w: 300, h: 600 },
        { w: 970, h: 250 }, { w: 336, h: 280 }, { w: 468, h: 60 },
        { w: 250, h: 250 }
    ];

    const getRandomImage = (w: number, h: number) => `https://picsum.photos/seed/${Math.random()}/${w}/${h}`;
    const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

    const stages: any[] = [];

    for (let i = 0; i < 30; i++) {
        const size = adSizes[i % adSizes.length];
        const stageId = generateId('st_stress');
        const layers: any[] = [];

        // Add 10 individual layers
        for (let j = 0; j < 10; j++) {
            const layerId = generateId('media');
            layers.push({
                id: layerId,
                name: layerId,
                type: 'image',
                url: getRandomImage(200, 200),
                x: Math.random() * size.w,
                y: Math.random() * size.h,
                width: 50 + Math.random() * 100,
                height: 50 + Math.random() * 100,
                rotation: Math.random() * 360,
                zIndex: j,
                animation: {
                    entry: { start: 0, duration: 50 },
                    main: { start: 100, duration: 50 },
                    exit: { start: 250, duration: 50 }
                }
            });
        }

        // Add 2 Top-Level Groups
        for (let g = 0; g < 2; g++) {
            const groupId = generateId('group');
            const groupLayers: any[] = [];

            // 3 layers inside each group
            for (let j = 0; j < 3; j++) {
                const layerId = generateId('media');
                groupLayers.push({
                    id: layerId,
                    name: layerId,
                    type: 'image',
                    url: getRandomImage(150, 150),
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    width: 40,
                    height: 40,
                    rotation: 0,
                    zIndex: j,
                    animation: {
                        entry: { start: 0, duration: 50 },
                        main: { start: 100, duration: 50 },
                        exit: { start: 250, duration: 50 }
                    }
                });
            }

            // 1 Nested Group
            const nestedGroupId = generateId('nested_group');
            const nestedLayers: any[] = [];
            for (let j = 0; j < 2; j++) {
                const layerId = generateId('media');
                nestedLayers.push({
                    id: layerId,
                    name: layerId,
                    type: 'image',
                    url: getRandomImage(100, 100),
                    x: Math.random() * 50,
                    y: Math.random() * 50,
                    width: 30,
                    height: 30,
                    rotation: 0,
                    zIndex: j,
                    animation: {
                        entry: { start: 0, duration: 50 },
                        main: { start: 100, duration: 50 },
                        exit: { start: 250, duration: 50 }
                    }
                });
            }

            groupLayers.push({
                id: nestedGroupId,
                name: nestedGroupId,
                type: 'group',
                x: 50,
                y: 50,
                width: 100,
                height: 100,
                rotation: 15,
                zIndex: 10,
                animation: {
                    entry: { start: 0, duration: 50 },
                    main: { start: 100, duration: 50 },
                    exit: { start: 250, duration: 50 }
                },
                children: nestedLayers
            });

            layers.push({
                id: groupId,
                name: groupId,
                type: 'group',
                x: Math.random() * size.w,
                y: Math.random() * size.h,
                width: 200,
                height: 200,
                rotation: 0,
                zIndex: 20 + g,
                animation: {
                    entry: { start: 0, duration: 50, name: 'fade-In' },
                    main: { start: 100, duration: 50, name: 'heartbeat' },
                    exit: { start: 250, duration: 50, name: 'fade-Out' }
                },
                children: groupLayers
            });
        }

        stages.push({
            id: stageId,
            name: `Stress Ad ${i + 1} (${size.w}x${size.h})`,
            width: size.w,
            height: size.h,
            duration: 3,
            loopCount: -1,
            layers
        });
    }

    return stages;
};
