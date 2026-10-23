import {describe,expect,it} from 'vitest';
import {normalizeStoryGradient,storyGradientStyle} from '../story-gradient';
describe('Story background gradient',()=>{
 it('preserves old projects without enabling a new effect',()=>expect(normalizeStoryGradient({})).toEqual({backgroundGradientEnabled:false,backgroundGradientIntensity:100,backgroundGradientLength:65}));
 it('uses independent intensity and height for preview and export',()=>expect(storyGradientStyle({backgroundGradientIntensity:75,backgroundGradientLength:40})).toEqual({height:'40%',background:'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.75) 100%)'}));
 it('handles transparent, full-height and invalid saved values',()=>{expect(storyGradientStyle({backgroundGradientIntensity:0,backgroundGradientLength:100}).height).toBe('100%');expect(storyGradientStyle({backgroundGradientIntensity:0}).background).toContain('rgba(0, 0, 0, 0) 100%');expect(normalizeStoryGradient({backgroundGradientIntensity:Infinity,backgroundGradientLength:-5})).toEqual({backgroundGradientEnabled:false,backgroundGradientIntensity:100,backgroundGradientLength:0});});
});
