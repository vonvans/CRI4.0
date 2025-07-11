/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/order */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import {useState, useEffect, useContext} from 'react';
import {NotificationContext} from '../../contexts/NotificationContext';
import {Badge, Switch} from "@nextui-org/react";
import {MoonIcon} from "./MoonIcon";
import {SunIcon} from "./SunIcon";
import {
  Navbar,
  NavbarContent,
  NavbarItem,
  Link
} from "@nextui-org/react";
import { FaCog } from "react-icons/fa";

export function AppNavbar({darkMode,setDarkMode}) {

  const [activeItem, setActiveItem] = useState(() => {
    const activeItem = localStorage.getItem("navbar");
    return activeItem ? JSON.parse(activeItem) : "home";
  });

  useEffect(() => {
    localStorage.setItem("navbar", JSON.stringify(activeItem));
  }, [activeItem]);

  const { attackLoaded } = useContext(NotificationContext);

  return (
    <Navbar position="static" maxWidth='full'>
      <NavbarContent justify="start">
          <NavbarItem isActive={activeItem === 'home'}>
              <Link onClick={() => setActiveItem('home')}
              color={activeItem == "home" ? "primary" : "foreground"} href="/">
                  Home
              </Link>
          </NavbarItem>
          <NavbarItem isActive={activeItem === 'topology'}>
            <Badge isInvisible={!attackLoaded} content="" placement='top-right' color="danger" size="sm" className='animate-pulse-fast'>
              <Link
                onClick={() => setActiveItem('topology')}
                color={activeItem == "topology" ? "primary" : "foreground"} href="/topology">
                  Topology
              </Link>
            </Badge>
          </NavbarItem>
          <NavbarItem isActive={activeItem === 'attack'}>
              <Link
                onClick={() => setActiveItem('attack')}
                color={activeItem == "attack" ? "primary" : "foreground"} href="/attack">
                  Attack
              </Link>
          </NavbarItem>
          <NavbarItem isActive={activeItem === 'report'}>
              <Link
                onClick={() => setActiveItem('report')}
                color={activeItem == "report" ? "primary" : "foreground"} href="/report">
                  Report
              </Link>
          </NavbarItem>
          <NavbarItem isActive={activeItem === 'logs'}>
              <Link
                onClick={() => setActiveItem('logs')}
                color={activeItem == "logs" ? "primary" : "foreground"} href="/logs">
                  Logs
              </Link>
          </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
          <NavbarItem isActive={activeItem === 'Images'}>
              <Link
                onClick={() => setActiveItem('images')}
                color={activeItem == "images" ? "primary" : "foreground"} href="/settings">
                  <FaCog size={24} className='mt-1' />
              </Link>
          </NavbarItem>
          <NavbarItem>
            <Switch
              defaultSelected
              isSelected={darkMode}
              size="lg"
              color="success"
              startContent={<SunIcon />}
              endContent={<MoonIcon />}
              onChange={() => {setDarkMode(!darkMode)}}
            />
          </NavbarItem>
      </NavbarContent>
  </Navbar>
  )
}
