import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios'; // Ensure axios is installed
import BPMNEditor from '../components/BPMNEditor';
import type BpmnJS from 'bpmn-js/lib/Modeler';

const API_BASE_URL = 'http://localhost:3001/api/modeler'; // Server base URL

interface DiagramMetadata {
  id: string;
  name: string;
  filename: string;
  createdAt?: string;
}

const ModelerPage: React.FC = () => {
  const [bpmnXml, setBpmnXml] = useState<string>('');
  
  // Load sample XML when component mounts
  useEffect(() => {
    fetch('/sample.xml')
      .then(response => response.text())
      .then(xml => {
        setBpmnXml(xml);
      })
      .catch(err => {
        console.error('Error loading sample XML:', err);
        setError('Failed to load sample XML file.');
      });
  }, []);
  const modelerRef = useRef<BpmnJS | null>(null);
  // Initialize with empty array and add loading state
  const [savedDiagrams, setSavedDiagrams] = useState<DiagramMetadata[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedDiagrams = useCallback(async () => {
    if (!isInitialized) {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get<DiagramMetadata[]>(`${API_BASE_URL}/diagrams`);
        setSavedDiagrams(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching saved diagrams:', err);
        setError('Failed to fetch saved diagrams.');
        // Ensure savedDiagrams is always an array even on error
        setSavedDiagrams([]);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }
  }, [isInitialized]);

  useEffect(() => {
    fetchSavedDiagrams();
  }, [fetchSavedDiagrams]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setBpmnXml(content);
        setCurrentDiagramId(null); // Loaded from file, not server
        setError(null);
      } catch (error) {
        console.error('Error reading BPMN file:', error);
        setError('Error reading BPMN file.');
      }
    };
    reader.onerror = (e) => {
      console.error('FileReader error:', e);
      setError('FileReader error.');
    };
    reader.readAsText(file);
  };

  const handleEditorReady = useCallback((modeler: BpmnJS) => {
    modelerRef.current = modeler;
  }, []);

  const handleDownloadLocal = async () => {
    if (!modelerRef.current) {
      alert('Editor not ready.');
      return;
    }
    try {
      const result = await modelerRef.current.saveXML({ format: true });
      const { xml } = result;
      if (xml) {
        const blob = new Blob([xml], { type: 'application/bpmn+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram.bpmn';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setError(null);
      }
    } catch (err) {
      console.error('Could not save BPMN 2.0 diagram locally', err);
      setError('Could not save BPMN diagram locally.');
    }
  };

  const handleSaveToServer = async () => {
    if (!modelerRef.current) {
      alert('Editor not ready.');
      return;
    }
    const name = window.prompt('Enter a name for the diagram:', currentDiagramId ? savedDiagrams.find(d=>d.id === currentDiagramId)?.name || 'Untitled Diagram' : 'Untitled Diagram');
    if (!name) {
      alert('Save cancelled: Diagram name is required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        setError('Failed to generate XML from editor.');
        setIsLoading(false);
        return;
      }
      // Note: For simplicity, we always POST. A PUT for existing currentDiagramId could be an enhancement.
      const response = await axios.post<DiagramMetadata>(`${API_BASE_URL}/diagrams`, { name, xml });
      setCurrentDiagramId(response.data.id);
      alert('Diagram saved successfully!');
      fetchSavedDiagrams(); // Refresh list
    } catch (err) {
      console.error('Error saving diagram to server:', err);
      setError('Failed to save diagram to server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDiagram = async (diagramId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<string>(`${API_BASE_URL}/diagrams/${diagramId}`, {
        responseType: 'text', // Ensure we get XML as text
      });
      setBpmnXml(response.data);
      setCurrentDiagramId(diagramId);
    } catch (err) {
      console.error(`Error loading diagram ${diagramId}:`, err);
      setError(`Failed to load diagram ${diagramId}.`);
    } finally {
      setIsLoading(false);
    }
  };
    const handleNewDiagram = () => {
    setIsLoading(true);
    fetch('/sample.xml')
      .then(response => response.text())
      .then(xml => {
        setBpmnXml(xml);
        setCurrentDiagramId(null);
        setError(null);
        setIsLoading(false);
        alert('New diagram created from sample. You can start editing.');
      })
      .catch(err => {
        console.error('Error loading sample XML:', err);
        setError('Failed to load sample XML file.');
        setIsLoading(false);
      });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <h1>Modeler Page {currentDiagramId ? `(Editing: ${savedDiagrams.find(d=>d.id === currentDiagramId)?.name || currentDiagramId})` : '(New Diagram)'}</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <div style={{ padding: '10px 0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input type="file" accept=".bpmn, .xml" onChange={handleFileChange} />
        <button onClick={handleSaveToServer} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save to Server'}
        </button>
        <button onClick={handleDownloadLocal} disabled={isLoading}>Download as BPMN</button>
        <button onClick={handleNewDiagram} disabled={isLoading}>New Diagram</button>
      </div>

      <div style={{ display: 'flex', flexGrow: 1, borderTop: '1px solid #eee' }}>
        <div style={{ width: '250px', borderRight: '1px solid #eee', padding: '10px', overflowY: 'auto' }}>
          <h2>Saved Diagrams</h2>
          {isLoading && savedDiagrams.length === 0 && <p>Loading diagrams...</p>}
          {savedDiagrams.length === 0 && !isLoading && <p>No diagrams saved yet.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {savedDiagrams.map((diagram) => (
              <li key={diagram.id} style={{ marginBottom: '10px', borderBottom: '1px solid #f0f0f0', paddingBottom: '5px' }}>
                <div style={{ fontWeight: 'bold' }}>{diagram.name}</div>
                <small>ID: {diagram.id}</small><br/>
                <small>Created: {diagram.createdAt ? new Date(diagram.createdAt).toLocaleString() : 'N/A'}</small><br/>
                <button onClick={() => handleLoadDiagram(diagram.id)} disabled={isLoading || currentDiagramId === diagram.id} style={{marginTop: '5px'}}>
                  {currentDiagramId === diagram.id ? 'Loaded' : 'Load'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flexGrow: 1, position: 'relative' /* For editor container to fill */ }}>ننن
          <BPMNEditor xml={bpmnXml} onEditorReady={handleEditorReady} />
        </div>
      </div>
    </div>
  );
};

export default ModelerPage;
