import React from 'react';
import { Composition } from 'remotion';
import { Bazar, BAZAR_DURATION } from './Bazar';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Bazar"
    component={Bazar}
    durationInFrames={BAZAR_DURATION}
    fps={30}
    width={1920}
    height={1080}
  />
);
