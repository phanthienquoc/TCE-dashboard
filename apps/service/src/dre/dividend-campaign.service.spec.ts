import { describe, expect, it, vi } from 'vitest';
import { DividendCampaignService } from './dividend-campaign.service';

const input = {
  event: {
    symbol: ' dpm ',
    eventId: 'dividend-2026',
    eventDate: '2026-10-21',
    source: 'test',
  },
};

function makeService() {
  const repository = {
    ensureIndexes: vi.fn().mockResolvedValue(undefined),
    findCampaignByEvent: vi.fn().mockResolvedValue(null),
    saveCampaign: vi.fn().mockResolvedValue(undefined),
    updateCampaignStatus: vi.fn(),
  };
  const lifecycleEvents = { publish: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new DividendCampaignService(repository as any, lifecycleEvents as any),
    repository,
    lifecycleEvents,
  };
}

describe('DividendCampaignService lifecycle events', () => {
  it('publishes after a campaign is persisted', async () => {
    const { service, repository, lifecycleEvents } = makeService();

    const campaign = await service.create(input);

    expect(repository.saveCampaign).toHaveBeenCalledWith(campaign);
    expect(lifecycleEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: campaign.id,
        lifecycleState: 'ACTIVE',
        aggregateId: campaign.id,
        occurredAt: campaign.updatedAt,
        reason: 'campaign_created',
      })
    );
  });

  it('does not emit a duplicate create event when the campaign already exists', async () => {
    const { service, repository, lifecycleEvents } = makeService();
    const existing = {
      id: 'DPM:dividend-2026',
      event: input.event,
      status: 'ACTIVE',
      targetTpMinPercent: 7,
      targetTpMaxPercent: 10,
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    };
    repository.findCampaignByEvent.mockResolvedValue(existing);

    await expect(service.create(input)).resolves.toBe(existing);
    expect(repository.saveCampaign).not.toHaveBeenCalled();
    expect(lifecycleEvents.publish).not.toHaveBeenCalled();
  });

  it('publishes status changes only after the repository confirms the updated campaign', async () => {
    const { service, repository, lifecycleEvents } = makeService();
    const updated = {
      id: 'DPM:dividend-2026',
      event: input.event,
      status: 'GAP',
      targetTpMinPercent: 7,
      targetTpMaxPercent: 10,
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    };
    repository.updateCampaignStatus.mockResolvedValue(updated);

    await expect(service.updateStatus(updated.id, 'GAP')).resolves.toBe(updated);
    expect(lifecycleEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: updated.id,
        lifecycleState: 'GAP',
        occurredAt: updated.updatedAt,
        reason: 'campaign_status_updated',
      })
    );
  });
});
