import type { Stage, Layer } from '../App';

export const generateShortId = (prefix: string) => {
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${randomStr}`;
};

export const createLandingPageStages = (startX: number, selectedSizes?: string[]): Stage[] => {
  const allConfigs = [
    { name: 'xlarge', width: 1440, height: 900 },
    { name: 'large', width: 1024, height: 768 },
    { name: 'medium', width: 768, height: 1024 },
    { name: 'small', width: 430, height: 932 },
    { name: 'xsmall', width: 375, height: 812 },
  ];

  const configs = selectedSizes 
    ? allConfigs.filter(c => selectedSizes.includes(c.name))
    : allConfigs;

  let currentX = startX + 100;
  const stages: Stage[] = [];
  const ancestorId = generateShortId('stage');

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const stageId = i === 0 ? ancestorId : generateShortId('stage');
    const layers: Layer[] = [];

    // Add Menu template for xlarge, small, xsmall
    if (config.name === 'xlarge') {
        const bgShapeId = generateShortId('layer');
        layers.push({
            id: bgShapeId,
            name: 'Menu Background',
            type: 'shape',
            x: 0,
            y: 0,
            width: config.width,
            height: 80,
            rotation: 0,
            zIndex: 1,
            variant: JSON.stringify({
                useHtml: true,
                shapeType: 'square',
                bgType: 'solid',
                fills: [{ id: 'menu-bg', type: 'solid', color: '#ffffff', visible: true, opacity: 1 }]
            })
        } as any);

        const logoId = generateShortId('layer');
        layers.push({
            id: logoId,
            name: 'Logo',
            type: 'text',
            x: 40,
            y: 25,
            width: 100,
            height: 30,
            rotation: 0,
            zIndex: 2,
            variant: JSON.stringify({
                content: 'LOGO',
                color: '#000000',
                fontSize: 24,
                fontWeight: 'bold',
                fontFamily: 'Inter',
                textAlign: 'left'
            })
        } as any);

        const link1Id = generateShortId('layer');
        layers.push({
            id: link1Id,
            name: 'Home Link',
            type: 'text',
            x: config.width - 350,
            y: 30,
            width: 80,
            height: 20,
            rotation: 0,
            zIndex: 2,
            variant: JSON.stringify({
                content: 'Home',
                color: '#333333',
                fontSize: 16,
                fontWeight: 400,
                fontFamily: 'Inter',
                textAlign: 'center'
            })
        } as any);

        const link2Id = generateShortId('layer');
        layers.push({
            id: link2Id,
            name: 'About Link',
            type: 'text',
            x: config.width - 250,
            y: 30,
            width: 80,
            height: 20,
            rotation: 0,
            zIndex: 2,
            variant: JSON.stringify({
                content: 'About',
                color: '#333333',
                fontSize: 16,
                fontWeight: 400,
                fontFamily: 'Inter',
                textAlign: 'center'
            })
        } as any);

        const link3Id = generateShortId('layer');
        layers.push({
            id: link3Id,
            name: 'Contact Link',
            type: 'text',
            x: config.width - 150,
            y: 30,
            width: 80,
            height: 20,
            rotation: 0,
            zIndex: 2,
            variant: JSON.stringify({
                content: 'Contact',
                color: '#333333',
                fontSize: 16,
                fontWeight: 400,
                fontFamily: 'Inter',
                textAlign: 'center'
            })
        } as any);

    } else if (config.name === 'small' || config.name === 'xsmall') {
        const bgShapeId = generateShortId('layer');
        layers.push({
            id: bgShapeId,
            name: 'Mobile Menu Background',
            type: 'shape',
            x: 0,
            y: 0,
            width: config.width,
            height: 60,
            rotation: 0,
            zIndex: 1,
            variant: JSON.stringify({
                useHtml: true,
                shapeType: 'square',
                bgType: 'solid',
                fills: [{ id: 'mobile-menu-bg', type: 'solid', color: '#ffffff', visible: true, opacity: 1 }]
            })
        } as any);

        const logoId = generateShortId('layer');
        layers.push({
            id: logoId,
            name: 'Logo',
            type: 'text',
            x: 20,
            y: 15,
            width: 80,
            height: 30,
            rotation: 0,
            zIndex: 2,
            variant: JSON.stringify({
                content: 'LOGO',
                color: '#000000',
                fontSize: 20,
                fontWeight: 'bold',
                fontFamily: 'Inter',
                textAlign: 'left'
            })
        } as any);

        const menuIconId = generateShortId('layer');
        layers.push({
            id: menuIconId,
            name: 'Hamburger Menu',
            type: 'text',
            x: config.width - 50,
            y: 15,
            width: 30,
            height: 30,
            rotation: 0,
            zIndex: 2,
            variant: JSON.stringify({
                content: '☰',
                color: '#000000',
                fontSize: 24,
                fontWeight: 400,
                fontFamily: 'Inter',
                textAlign: 'right'
            })
        } as any);
    }

    stages.push({
      id: stageId,
      name: config.name,
      x: currentX,
      y: 100,
      width: config.width,
      height: config.height,
      layers: layers,
      duration: 10,
      loopCount: -1,
      feedLoopCount: -1,
      actions: [],
      overflow: 'hidden',
      sourceStageId: i === 0 ? undefined : ancestorId
    });

    currentX += config.width + 100; // 100px gap between stages
  }

  return stages;
};
