import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EXPLORE_CHEFS_SELECT, galleryUrls, MAX_CHEF_DISH_PHOTOS, resolvePortrait } from '../chefProfile'
import { mapExploreChefRow } from '../mapExploreChefs'

describe('chef profile helpers', () => {
  it('keeps English portrait optional and falls back to French', () => {
    assert.equal(resolvePortrait({ portraitFr: 'Bonjour', portraitEn: null }, 'en'), 'Bonjour')
    assert.equal(resolvePortrait({ portraitFr: 'Bonjour', portraitEn: '  ' }, 'en'), 'Bonjour')
    assert.equal(resolvePortrait({ portraitFr: 'Bonjour', portraitEn: 'Hello' }, 'en'), 'Hello')
    assert.equal(resolvePortrait({ portraitFr: 'Bonjour', portraitEn: 'Hello' }, 'fr'), 'Bonjour')
    assert.equal(resolvePortrait({ portraitFr: '', portraitEn: '' }, 'fr'), null)
  })

  it('deduplicates gallery urls and prefers the primary dish photo', () => {
    assert.deepEqual(
      galleryUrls({
        primaryDishPhoto: 'https://img/primary.jpg',
        dishPhotos: ['https://img/primary.jpg', 'https://img/two.jpg', '  ', 'https://img/two.jpg'],
        profilePicture: 'https://img/avatar.jpg',
      }),
      ['https://img/primary.jpg', 'https://img/two.jpg']
    )
    assert.deepEqual(
      galleryUrls({ primaryDishPhoto: null, dishPhotos: [], profilePicture: 'https://img/avatar.jpg' }),
      []
    )
  })

  it('keeps the explore payload lean', () => {
    assert.equal(MAX_CHEF_DISH_PHOTOS, 12)
    assert.equal(EXPLORE_CHEFS_SELECT.includes('portrait_fr'), false)
    assert.equal(EXPLORE_CHEFS_SELECT.includes('dish_photos'), false)
    assert.equal(EXPLORE_CHEFS_SELECT.includes('info_link_xx'), false)
    assert.equal(EXPLORE_CHEFS_SELECT.includes('primary_dish_photo'), true)
    assert.equal(EXPLORE_CHEFS_SELECT.includes('menus(name,price)'), true)
    assert.equal(EXPLORE_CHEFS_SELECT.includes('description'), false)
  })
})

describe('mapExploreChefRow', () => {
  it('maps a lean chef row without gallery or wordpress fields', () => {
    const chef = mapExploreChefRow({
      id: 'abc',
      slug: 'chef-demo',
      name: 'Camille',
      city: 'Paris',
      profile_picture: 'https://img/avatar.jpg',
      primary_dish_photo: 'https://img/hero.jpg',
      cuisine_style: 'Français',
      cuisine_style_en: 'French',
      availability_radius_km: 25,
      min_guests: 2,
      max_guests: 8,
      latitude: 48.85,
      longitude: 2.35,
      menus: [{ name: 'Menu', price: 95 }, { name: 'Menu 2', price: 80 }],
    })
    assert.equal(chef.slug, 'chef-demo')
    assert.equal(chef.heroImage, 'https://img/hero.jpg')
    assert.equal(chef.minPrice, 80)
    assert.equal(chef.city, 'Paris')
    assert.equal('infoLinkXx' in chef, false)
    assert.equal('dishPhotos' in chef, false)
  })
})
