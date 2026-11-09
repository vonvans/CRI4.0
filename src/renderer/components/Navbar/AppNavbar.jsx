/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/order */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { TerminalContext } from '../../contexts/TerminalContext';
import { Badge, Switch, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { MoonIcon } from "./MoonIcon";
import { SunIcon } from "./SunIcon";
import {
  Navbar,
  NavbarContent,
  NavbarItem,
  Link
} from "@nextui-org/react";
import { FaCog, FaTerminal } from "react-icons/fa";

export function AppNavbar({ darkMode, setDarkMode }) {

  const location = useLocation();
  const { pathname } = location;

  const { activeTerminals, setActiveTerminals } = useContext(TerminalContext);

  return (
    <Navbar position="static" maxWidth='full'>
      <NavbarContent justify="start">
        <NavbarItem isActive={pathname === '/'}>
          <Link
            color={pathname === "/" ? "primary" : "foreground"} href="/">
            Home
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/attack'}>
          <Link
            color={pathname === "/attack" ? "primary" : "foreground"} href="/attack">
            Attack
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/topology'}>
          <Link
            color={pathname === "/topology" ? "primary" : "foreground"} href="/topology">
            Topology
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/report'}>
          <Link
            color={pathname === "/report" ? "primary" : "foreground"} href="/report">
            Report
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/logs'}>
          <Link
            color={pathname === "/logs" ? "primary" : "foreground"} href="/logs">
            Logs
          </Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem isActive={pathname === '/settings'}>
          <Link
            color={pathname === "/settings" ? "primary" : "foreground"} href="/settings">
            <FaCog size={24} className='mt-1' />
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <div className="cursor-pointer relative mt-1 mx-2">
                <Badge
                  content={activeTerminals.length}
                  color="danger"
                  shape="circle"
                  size="sm"
                  isInvisible={activeTerminals.length === 0}
                >
                  <FaTerminal size={22} className="text-default-500 hover:text-default-900 transition-colors" />
                </Badge>
              </div>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Active Terminals"
              emptyContent="No active terminals"
              onAction={(key) => {
                // Determine logic to restore terminal:
                // We simply set its minimized state to false.
                // We also might need to navigate to topology if not there.
                setActiveTerminals(prev => prev.map(t => t.nodeId === key ? { ...t, minimized: false } : t));
                if (pathname !== '/topology') {
                  window.location.href = '/topology';
                }
              }}
            >
              {activeTerminals.map(term => (
                <DropdownItem key={term.nodeId} description={term.minimized ? "Minimized" : "Active"}>
                  {term.nodeId}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
        <NavbarItem>
          <Switch
            defaultSelected
            isSelected={darkMode}
            size="lg"
            color="success"
            startContent={<SunIcon />}
            endContent={<MoonIcon />}
            onChange={() => { setDarkMode(!darkMode) }}
          />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  )
}
