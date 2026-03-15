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
            const parsedImages = images_list.map(image => {
                const [_, rest] = image.split('icr/');
                const [name] = rest.split(':');
                const [category, ...nameParts] = name.split('-');
                const imageName = nameParts.join('-');
                return { category, name: imageName, image: image };
            });

            const updatedAttacks = attacksModel.map(attack => {
                const matchingImage = parsedImages.find(image => image.name === attack.name);
                if (matchingImage) {
                    return { ...attack, image: matchingImage.image, isImage: true };
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
