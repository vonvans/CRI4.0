/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { Button } from '@nextui-org/react'
import { useRef } from 'react';

export function Mock({machines, componentRefs}) {
    const observerRef = useRef(null);

    const scrollToComponent = (index) => {
        console.log(componentRefs.current)
        if (componentRefs.current[index]) {
            console.log("scroll")
            componentRefs.current[index].scrollIntoView({
                behavior: "smooth",
                block: "center",
            });

            observerRef.current = new IntersectionObserver(
                ([entry]) => {
                  if (entry.isIntersecting) {
                    observerRef.current.disconnect(); // Stop observing
                    componentRefs.current[index].parentNode.parentNode.classList.add("animate-pulse-fast");

                    setTimeout(() => {
                        componentRefs.current[index].parentNode.parentNode.classList.remove("animate-pulse-fast");
                    }, 1000);
                  }
                },
                { threshold: 1.0 }
            );

            observerRef.current.observe(componentRefs.current[index]);
        }
    };

    return (
        <div className="grid gap-2">
            <div>
                <div className='shadow-medium bg-content1 border-black/20 rounded-md p-3 grid gap-1'>
                    <div className="text-sm">
                        Machines Map
                    </div>
                    {machines.map((m, index) => (
                        <Button key={index} onClick={() => scrollToComponent(index)} className="rounded-md max-h-8 w-full border-1 border-white/50 hover:bg-primary" radius='none'>
                            <div className='w-full grid grid-cols-2 justify-items-start'>
                                <div className='bg-content1 h-full w-5 rounded-full'>{index}</div>
                                <div>{m.name || `pc${index}`}</div>
                            </div>
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    )
}
