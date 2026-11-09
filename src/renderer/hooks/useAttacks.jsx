/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable object-shorthand */
/* eslint-disable camelcase */
/* eslint-disable promise/always-return */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from 'react';
import { attacksModel } from '../models/model';
import { api } from '../api';

export default function useAttacks(refresh) {
    const [attacks, setAttacks] = useState(attacksModel);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        api.getDockerImages().then((images_list) => {
            const updatedAttacks = attacksModel.map(attack => {
                const searchString = `icr/${attack.category.toLowerCase()}-${attack.name}`;
                // Trova l'immagine che inizia con il pattern corretto (gestisce tag come :latest)
                const matchingImage = images_list.find(img => img.startsWith(searchString));
                if (matchingImage) {
                    return { ...attack, image: matchingImage, isImage: true };
                }
                return { ...attack, image: '', isImage: false };
            });
            setIsLoading(false);
            setAttacks(updatedAttacks);
            console.log(updatedAttacks)
        }).catch(() => {
            setIsLoading(false);
        });
    }, [refresh]);

    return [attacks, isLoading];
}
