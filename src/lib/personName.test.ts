import { compareNames, foldName, personNameFromFull, personNameFromParts, spellingCloseness } from './personName';

const full = personNameFromFull;

describe('foldName', () => {
  it.each([
    ['Nguyễn Văn An', 'nguyen van an'],
    ['NGUYEN   VAN   AN', 'nguyen van an'],
    ['Đặng Thị Hồng', 'dang thi hong'],
    ["O'Brien-Tran", 'obrien tran'],
    ['  Kevin J. Nguyen ', 'kevin j nguyen'],
  ])('%s → %s', (input, expected) => {
    expect(foldName(input)).toBe(expected);
  });

  it('keeps names in non-Latin scripts comparable instead of erasing them', () => {
    expect(foldName('陈 美')).toBe('陈 美');
  });
});

describe('compareNames', () => {
  it('treats accents, case, spacing and middle initials as the same name', () => {
    expect(compareNames(full('Nguyễn Văn An'), full('NGUYEN  VAN AN')).relation).toBe('exact');
    expect(compareNames(full('Kevin J. Nguyen'), full('Kevin Nguyen')).relation).toBe('exact');
    expect(compareNames(full('Kevin J Nguyen'), personNameFromParts('Kevin', 'Nguyen')).relation).toBe('exact');
  });

  it('matches a structured compound given name against the same full name', () => {
    expect(compareNames(personNameFromParts('Thanh Tâm', 'Nguyễn'), full('Thanh Tam Nguyen')).relation).toBe('exact');
  });

  it('recognizes an omitted middle name, separately from an exact match', () => {
    expect(compareNames(full('Vincent Truong Nguyen'), full('Vincent Nguyen')).relation).toBe('middle_omitted');
    expect(compareNames(full('Nguyen An'), full('Nguyen Van An')).relation).toBe('middle_omitted');
  });

  it('does not call two different middle names an omission', () => {
    expect(compareNames(full('Vincent Minh Nguyen'), full('Vincent Truong Nguyen')).relation).toBe('similar');
  });

  it('flags a shortened first name without expanding nicknames', () => {
    expect(compareNames(full('Alex Nguyen'), full('Alexander Nguyen')).relation).toBe('first_name_prefix');
    expect(compareNames(full('Bill Tran'), full('William Tran')).relation).toBe('different');
  });

  it('flags family-name-first order as a lead only', () => {
    expect(compareNames(full('Nguyen An'), full('An Nguyen')).relation).toBe('reordered');
    expect(compareNames(full('Nguyen Van An'), full('An Nguyen')).relation).toBe('similar');
  });

  it('treats close Vietnamese given names as a lead, never as the same name', () => {
    expect(compareNames(full('An Nguyen'), full('Anh Nguyen')).relation).toBe('similar');
  });

  it('separates clearly different people who share a surname', () => {
    expect(compareNames(full('Ryan Le'), full('Bao Le')).relation).toBe('different');
    expect(compareNames(full('Lan Tran'), full('Minh Vo')).relation).toBe('different');
  });

  it('never relates an empty name', () => {
    expect(compareNames(full(''), full('An Tran')).relation).toBe('different');
  });
});

describe('spellingCloseness', () => {
  it('is a 0-100 ordering heuristic', () => {
    expect(spellingCloseness('an', 'an')).toBe(100);
    expect(spellingCloseness('abc', 'xyz')).toBe(0);
    expect(spellingCloseness('', 'x')).toBe(0);
  });
});
