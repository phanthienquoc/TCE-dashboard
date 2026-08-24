import { PoolCandidateService } from './pool-candidate.service';

describe('PoolCandidateService', () => {
  const service = new PoolCandidateService();

  it('promotes a triggered candidate when a position slot is available', () => {
    expect(service.shouldPromote({ poolStatus: 'TRIGGERED', openSlots: 1, score: 70 })).toBe(true);
  });

  it('does not promote when two positions are already occupied', () => {
    expect(service.shouldPromote({ poolStatus: 'TRIGGERED', openSlots: 0, score: 90 })).toBe(false);
  });

  it('does not promote a passive pool row', () => {
    expect(service.shouldPromote({ poolStatus: 'WATCHING', openSlots: 1, score: 90 })).toBe(false);
  });
});
