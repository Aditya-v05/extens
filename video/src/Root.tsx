import React from 'react';
import { Composition } from 'remotion';
import { Demo, TOTAL } from './Demo';

export const Root = () => (
  <>
    <Composition id="SiftDemo" component={Demo} durationInFrames={TOTAL} fps={30} width={1600} height={1000} defaultProps={{ vertical: false }} />
    <Composition id="SiftDemoVertical" component={Demo} durationInFrames={TOTAL} fps={30} width={720} height={1280} defaultProps={{ vertical: true }} />
  </>
);
