import { expect } from 'chai';
import 'mocha';
import { decode, encode } from './qr';
import { QrType, QrData } from './qr.types';

describe('QR content encoding/decode', () => {
  it('Throws format error if too short', () => {
    expect(() => decode('EQ1ybkhZksI')).to.throw('Format Error');
  });

  const validContent = '92c2EQ1ybkhZHello';

  it('Decodable', () => {
    decode(validContent);
  });

  it('Changing any symbol fails signature check', () => {
    for (let i = 0; i < validContent.length; ++i) {
      const changedContent = validContent.slice(0, i) + 'A' + validContent.slice(i + 1);
      expect(() => decode(changedContent)).to.throw('Validation Error');
    }
  });

  it('Invalid symbols in signature lead to format error', () => {
    const content = 'X2c2EQ1ybkhZHello'; // Symbol X is not hex symbol
    expect(() => decode(content)).to.throw('Format Error');
  });

  it('Invalid symbols in header lead to exception', () => {
    for (let i = 4; i < 4 + 8; ++i) {
      // ? is not base64 symbol
      const changedContent = validContent.slice(0, i) + '?' + validContent.slice(i + 1);
      expect(() => decode(changedContent)).to.throw();
    }
  });

  it('Can decode example content', () => {
    const decoded = decode('d810Aw1ybkhZHello');
    expect(decoded).to.deep.equal({ type: QrType.InstantEffect, kind: 13, validUntil: 1497919090, payload: 'Hello' });
  });

  it('Can decode example content 2', () => {
    const decoded = decode('5472BwAA8VNl123,1267,abc');
    expect(decoded).to.deep.equal({ type: QrType.Bill, kind: 0, validUntil: 1700000000, payload: '123,1267,abc' });
  });

  it('Can decode example content 3', () => {
    const decoded = decode('9447AQDQvrZe178').payload;
    expect(decoded).to.equal('178');
  });

  it('Can decode example content 4', () => {
    const decoded = decode('c112AQCIyrZe178').payload;
    expect(decoded).to.equal('178');
  });

  it('Can encode example content', () => {
    const encoded = encode({ type: QrType.InstantEffect, kind: 13, validUntil: 1497919090, payload: 'Hello' });
    expect(encoded).to.equal('d810Aw1ybkhZHello');
  });

  it('Can encode example content 2', () => {
    const data: QrData = { type: QrType.Bill, kind: 0, validUntil: 1700000000, payload: '123,1267,abc' };
    expect(encode(data)).to.deep.equal('5472BwAA8VNl123,1267,abc');
  });

  it('Can encode and decode example content with cyrillic characters', () => {
    const data: QrData = { type: QrType.InstantEffect, kind: 13, validUntil: 1497919090, payload: 'Рыба' };
    expect(decode(encode(data))).to.deep.equal(data);
  });
});
