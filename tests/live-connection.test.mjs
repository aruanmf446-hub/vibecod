import test from 'node:test';
import assert from 'node:assert/strict';
import { TikTokLiveConnection, RouteConfig } from 'tiktok-live-connector';

test('biblioteca real: catálogo opcional causa Business; sem catálogo conecta pelo fluxo comunitário', async () => {
  const original = { ...RouteConfig };
  let catalogs = 0, sockets = 0;
  const gift = { giftId: 5655, repeatCount: 1, repeatEnd: 1,
    giftDetails: { giftName: 'Rose', giftType: 1, diamondCount: 1 },
    user: { userId: '123', nickname: 'Lucas' } };
  try {
    RouteConfig.fetchRoomInfo = async () => ({ data: { status: 2 } });
    RouteConfig.fetchRoomGifts = async () => {
      catalogs++;
      throw Error('This endpoint requires a Business plan.');
    };
    RouteConfig.fetchSignedWebSocketFromProvider = async () => {
      sockets++;
      return { fetchResult: { cursor: 'fixture', internalExt: '', pushServer: 'wss://example.test',
        messages: [{ decodedData: { type: 'WebcastGiftMessage', data: gift } }] } };
    };
    const old = new TikTokLiveConnection('canal', { enableExtendedGiftInfo: true });
    old.on('error', () => {});
    await assert.rejects(old.connect('12345'), /Business/);
    assert.equal(catalogs, 1); assert.equal(sockets, 0);

    const current = new TikTokLiveConnection('canal', { enableExtendedGiftInfo: false, processInitialData: false });
    // Only the external socket transport is replaced; connect/state machine and event decoding flow are real.
    current.setupWebsocket = async () => {};
    const events = [];
    current.on('gift', event => events.push(event));
    current.on('error', () => {});
    await current.connect('12345');
    assert.equal(current.isConnected, true);
    assert.equal(catalogs, 1); assert.equal(sockets, 1);
    assert.equal(events.length, 0, 'o lote antigo não entra na batalha');
    await current.processDecodedData({ type: 'WebcastGiftMessage', data: gift });
    assert.equal(events.length, 1);
    assert.equal(events[0].giftDetails.giftName, 'Rose');
    assert.equal(events[0].giftDetails.diamondCount, 1);
    assert.equal(events[0].repeatEnd, 1);
    assert.equal(events[0].extendedGiftInfo, undefined);
    await current.disconnect();
  } finally {
    Object.assign(RouteConfig, original);
  }
});
