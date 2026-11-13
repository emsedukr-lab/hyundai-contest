import { describe, expect, it } from 'vitest';
import { categoryOf } from '../src/kakao';

describe('categoryOf: a searched place\'s kind from Kakao\'s group code and category path', () => {
  it('keeps a restaurant a meal', () => {
    expect(categoryOf('FD6', '음식점 > 한식 > 국밥')).toBe('FOOD');
    expect(categoryOf('FD6', '음식점 > 술집 > 실내포장마차')).toBe('FOOD');
    expect(categoryOf('FD6', '')).toBe('FOOD'); // no path given: the group code decides, as before
  });
  it('does not call a snack shop a restaurant', () => {
    // A hangwa or rice-cake shop sells things to take away: it is a shop, not a meal.
    expect(categoryOf('FD6', '음식점 > 간식 > 떡,한과')).toBe('OTHER');
    expect(categoryOf('FD6', '음식점 > 간식 > 닭강정')).toBe('OTHER');
    expect(categoryOf('FD6', '음식점 > 간식')).toBe('OTHER');
    // A bakery or an ice-cream place is a dessert stop.
    expect(categoryOf('FD6', '음식점 > 간식 > 제과,베이커리')).toBe('CAFE');
    expect(categoryOf('FD6', '음식점 > 간식 > 아이스크림')).toBe('CAFE');
  });
  it('maps the other groups as before', () => {
    expect(categoryOf('CE7', '음식점 > 카페 > 커피전문점')).toBe('CAFE');
    expect(categoryOf('AD5', '여행 > 숙박 > 호텔')).toBe('LODGING');
    expect(categoryOf('AT4', '여행 > 관광,명소 > 호수')).toBe('SIGHT');
    expect(categoryOf('', '가정,생활 > 식품판매')).toBe('OTHER');
  });
});
