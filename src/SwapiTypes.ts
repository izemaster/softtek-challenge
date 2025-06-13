export type CharacterProperties = {
  created: Date,
  edited: Date,
  name: string,
  gender: string,
  skin_color: string,
  hair_color: string,
  height: number,
  eye_color: string,
  mass: number,
  homeworld: string,
  birth_year: string,
  url: string
}

export type CharacterResponse ={
    result: CharacterData
}

export type PlanetResponse ={
    result: PlanetData
}
export type PlanetProperties = {
    created: Date,
    edited: Date,
    climate: string,
    surface_water: number,
    name: string,
    diameter: number,
    rotation_period: number,
    terrain: string,
    gravity: string,
    orbital_period: number,
    population: number,
    url: string
}

export type DefaultData = {
    _id: string,
    description: string,
    __v: number
}

export type CharacterData = {
    properties : CharacterProperties,
} & DefaultData

export type PlanetData = {
    properties : PlanetProperties,
} & DefaultData