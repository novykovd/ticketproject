

export function applyGpsNoise(perfectVector: {x: number, y: number}, maxAngle: number) {
    const randomAngleDeg = (Math.random() * maxAngle * 2) - maxAngle;
    const radians = randomAngleDeg * (Math.PI / 180);

    return { 
        x: perfectVector.x * Math.cos(radians) - perfectVector.y * Math.sin(radians), 
        y: perfectVector.x * Math.sin(radians) + perfectVector.y * Math.cos(radians) 
    };
}