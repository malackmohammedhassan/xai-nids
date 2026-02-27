"""
Plugin registry — auto-discovers plugins in PLUGIN_DIR via importlib.
Failed plugins are logged and skipped; server continues running.
"""
from __future__ import annotations

import importlib.util
import inspect
import sys
from pathlib import Path
from typing import Dict, List, Optional

from core.logger import get_logger
from plugins.base_plugin import BaseMLPlugin

logger = get_logger("plugin_registry")

_registry: Dict[str, BaseMLPlugin] = {}
_loaded = False


def _discover_plugins() -> None:
    global _loaded
    if _loaded:
        return

    from core.config import get_settings
    plugin_dir = Path(get_settings().plugin_dir)

    # Always register built-in XAI-IDS plugin
    try:
        from plugins.xai_ids_plugin import XAIIDSPlugin
        instance = XAIIDSPlugin()
        _registry[instance.plugin_name] = instance
        logger.info("Registered built-in plugin", extra={"plugin": instance.plugin_name})
    except Exception as exc:
        logger.error("Failed to load XAIIDSPlugin", extra={"error": str(exc)})

    # Scan PLUGIN_DIR for additional *_plugin.py files
    if plugin_dir.exists():
        for py_file in sorted(plugin_dir.glob("*_plugin.py")):
            if py_file.name == "xai_ids_plugin.py":
                continue
            try:
                spec = importlib.util.spec_from_file_location(py_file.stem, py_file)
                if spec and spec.loader:
                    mod = importlib.util.module_from_spec(spec)
                    sys.modules[py_file.stem] = mod
                    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
                    for _name, obj in inspect.getmembers(mod, inspect.isclass):
                        if (
                            issubclass(obj, BaseMLPlugin)
                            and obj is not BaseMLPlugin
                            and obj.plugin_name
                        ):
                            instance = obj()
                            _registry[instance.plugin_name] = instance
                            logger.info("Plugin loaded", extra={"plugin": instance.plugin_name, "file": str(py_file)})
            except Exception as exc:
                logger.warning("Plugin load failed — skipping", extra={"file": str(py_file), "error": str(exc)})

    _loaded = True


def get_plugin(name: Optional[str] = None) -> BaseMLPlugin:
    _discover_plugins()
    if name is None:
        if not _registry:
            raise RuntimeError("No plugins registered")
        return next(iter(_registry.values()))
    if name not in _registry:
        available = list(_registry.keys())
        raise RuntimeError(f"Plugin '{name}' not found. Available: {available}")
    return _registry[name]


def list_plugins() -> List[Dict[str, str]]:
    _discover_plugins()
    return [
        {
            "name": p.plugin_name,
            "version": p.plugin_version,
            "supported_models": p.supported_models,
        }
        for p in _registry.values()
    ]


def get_all_supported_models() -> List[str]:
    _discover_plugins()
    models: List[str] = []
    for plugin in _registry.values():
        for m in plugin.supported_models:
            if m not in models:
                models.append(m)
    return models
