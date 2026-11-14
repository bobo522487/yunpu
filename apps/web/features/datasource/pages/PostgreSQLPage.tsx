
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Info, Plus, Save, Trash2, Eye, EyeOff, Check, ChevronDown, RefreshCw, Play } from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";
import { Label } from "../../../components/ui/label";
import { cn } from "../../../lib/utils";
import { useRouteContext } from "../../../hooks/useRouteContext";

const PostgresIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8">
    <g clipPath="url(#icon_svg__clip0_817_123566)">
      <path d="M22.5997 14.7561C19.7382 15.346 19.5409 14.3771 19.5409 14.3771C22.5626 9.89437 23.8244 4.20252 22.7345 2.80983C19.7616 -0.989298 14.6147 0.807719 14.5288 0.854598L14.4995 0.858505C13.935 0.741308 13.3021 0.67099 12.5911 0.65927C11.2961 0.637784 10.3136 0.999141 9.56938 1.56364C9.56938 1.56364 0.38702 -2.21986 0.814788 6.32183C0.906592 8.13837 3.41851 20.069 6.41679 16.4652C7.51258 15.1467 8.57126 14.0334 8.57126 14.0334C9.09669 14.383 9.7276 14.5608 10.3859 14.4963L10.4366 14.4533C10.421 14.6174 10.4288 14.7776 10.4562 14.967C9.68463 15.8304 9.91121 15.9808 8.36616 16.2992C6.80354 16.6215 7.72158 17.1938 8.32124 17.3442C9.04786 17.5258 10.7277 17.7837 11.8645 16.1937L11.8196 16.3754C12.1223 16.6176 12.3352 17.9516 12.3001 19.1607C12.2649 20.3698 12.2415 21.2 12.4798 21.8484C12.7181 22.4969 12.9564 23.956 14.9858 23.5204C16.6813 23.1571 17.5602 22.2157 17.6833 20.6452C17.7693 19.5279 17.9665 19.694 17.9783 18.6958L18.1365 18.2232C18.3181 16.7094 18.1658 16.221 19.2108 16.4476L19.4647 16.4691C20.2343 16.5043 21.2402 16.3461 21.8301 16.0706C23.0978 15.4827 23.8537 14.4963 22.5997 14.7561Z" fill="#336791"/>
      <path d="M11.634 15.6136C11.6399 15.4182 11.802 15.2639 11.9973 15.2698C12.1927 15.2756 12.347 15.4378 12.3411 15.6331C12.3001 17.0844 12.3079 18.5396 12.3606 19.7037C12.4095 20.7526 12.4935 21.5418 12.6107 21.8348C12.7357 22.1453 12.929 22.6043 13.3002 22.9149C13.6615 23.2196 14.2182 23.4052 15.105 23.2157C15.8804 23.0497 16.402 22.8133 16.7497 22.452C17.0934 22.0945 17.2888 21.5886 17.4099 20.8816C17.4997 20.3659 17.6228 19.4654 17.7341 18.5689C17.8747 17.4477 18.0037 16.3148 18.031 15.9495C18.0447 15.7542 18.2146 15.6077 18.4099 15.6233C18.6053 15.637 18.7518 15.8069 18.7361 16.0023C18.7088 16.3578 18.5799 17.5043 18.4334 18.6587C18.3162 19.5846 18.1912 20.5026 18.1052 21.0007C17.9587 21.8465 17.7107 22.4696 17.2556 22.9423C16.8024 23.413 16.1676 23.7099 15.2476 23.9072C14.1049 24.1513 13.351 23.8837 12.8411 23.454C12.3392 23.0321 12.1009 22.4735 11.9504 22.0965C11.802 21.7273 11.7024 20.8562 11.6496 19.733C11.5989 18.5591 11.593 17.0844 11.634 15.6136Z" fill="white"/>
      <path d="M9.68476 1.17298C9.86641 1.24525 9.95431 1.45035 9.88204 1.632C9.80977 1.81366 9.60467 1.90156 9.42302 1.82928C9.39958 1.81952 0.746552 -1.71592 1.14697 6.26909C1.19581 7.25549 1.97712 11.291 3.16471 14.1056C3.53974 14.9924 3.95188 15.7503 4.38942 16.2347C4.75468 16.641 5.12776 16.8363 5.48716 16.7074C5.68639 16.6351 5.8993 16.473 6.12393 16.2035C7.22362 14.8811 8.2237 13.8361 8.22761 13.8341C8.36239 13.6935 8.58506 13.6876 8.7257 13.8224C8.86633 13.9572 8.87219 14.1799 8.73742 14.3205C8.73546 14.3225 7.75882 15.3401 6.66694 16.6547C6.35637 17.0297 6.03994 17.2621 5.72155 17.3754C5.04572 17.6157 4.42458 17.3344 3.86203 16.7094C3.36981 16.1644 2.91664 15.3382 2.51427 14.3791C1.29347 11.4902 0.490672 7.32581 0.439887 6.30229C-0.0152269 -2.79217 9.65741 1.16126 9.68476 1.17298Z" fill="white"/>
      <path d="M14.7027 1.11828L14.1772 0.54402C14.2202 0.528394 14.2632 0.514721 14.3062 0.503001C14.4214 0.465889 14.5464 0.428776 14.6812 0.389711C14.8785 0.331112 15.1676 0.254935 15.5211 0.18657C17.2849 -0.155254 20.7266 -0.340815 22.9943 2.55785C23.635 3.37627 23.5823 5.40182 22.9201 7.80045C22.3341 9.92367 21.2774 12.3711 19.8164 14.5393C19.707 14.7014 19.4863 14.7444 19.3241 14.635C19.162 14.5256 19.119 14.3049 19.2284 14.1427C20.6465 12.0391 21.67 9.66583 22.2384 7.61098C22.8439 5.4194 22.9397 3.63215 22.4377 2.99148C20.4023 0.391664 17.2634 0.567459 15.652 0.881937C15.3219 0.946395 15.0582 1.01476 14.8785 1.0675L14.7027 1.11828Z" fill="white"/>
      <path d="M19.8572 14.2326C19.8611 14.2424 19.8631 14.2521 19.865 14.2619C19.865 14.2639 19.9861 14.8948 22.5078 14.3752C22.8653 14.301 23.1192 14.3166 23.2833 14.3967C23.4962 14.4982 23.588 14.6682 23.5743 14.8869C23.5665 15.0198 23.504 15.1624 23.4004 15.305C23.1621 15.6311 22.6172 16.0531 21.955 16.3597C21.4589 16.5902 20.703 16.7445 20.0096 16.7836C19.6013 16.807 19.2107 16.7914 18.9001 16.7289C18.5094 16.6508 18.2125 16.4886 18.0895 16.2249C18.0563 16.1546 18.0367 16.0785 18.0328 15.9964C17.9547 14.6252 18.6227 14.385 19.0896 14.2521C19.0407 14.1818 18.9743 14.0978 18.9001 14.006C18.6637 13.7111 18.361 13.3321 18.1207 12.752C18.0836 12.6641 17.9762 12.4688 17.8317 12.211C17.2203 11.1152 16.0171 8.95484 16.2534 7.48011C16.4214 6.4273 17.2242 5.72802 19.2302 5.93702L19.2107 5.87843C19.115 5.60692 18.9626 5.25142 18.7419 4.85295C17.8668 3.25908 15.9585 1.03625 12.5695 0.981556C7.39919 0.897565 7.56912 7.41761 7.56912 7.43519C7.57303 7.63052 7.41677 7.79069 7.22144 7.79459C7.02611 7.7985 6.86594 7.64224 6.86204 7.44691C6.86204 7.42542 6.67062 0.178758 12.5793 0.274469C16.31 0.33502 18.404 2.76881 19.3611 4.51113C19.5994 4.94476 19.7693 5.33932 19.8767 5.64599C19.9978 5.98976 20.0428 6.25932 20.0232 6.37847C19.9959 6.55426 19.8982 6.66364 19.7302 6.69685L19.6033 6.6988C17.7633 6.40386 17.0679 6.85507 16.9507 7.5895C16.7534 8.82592 17.8785 10.8417 18.4489 11.8672C18.6032 12.1445 18.7204 12.3555 18.7731 12.4844C18.9763 12.9747 19.2419 13.3067 19.449 13.5685C19.6423 13.8048 19.7947 13.9963 19.8572 14.2326ZM22.6504 15.0667C20.7811 15.4534 19.9099 15.1702 19.5095 14.8655C19.4548 14.883 19.3962 14.8987 19.3337 14.9162C19.0837 14.9866 18.695 15.0959 18.736 15.9359C18.7653 15.9671 18.8747 16.0003 19.0349 16.0335C19.2908 16.0843 19.6189 16.096 19.9685 16.0765C20.5799 16.0413 21.2382 15.9105 21.6581 15.7151C22.0898 15.514 22.4512 15.2717 22.6738 15.0608L22.6504 15.0667Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="icon_svg__clip0_817_123566">
        <rect width="24" height="24" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const PostgreSQLPage = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();
  const { id } = useParams();
  const isEditMode = !!id;

  // Form State
  const [name, setName] = useState('PostgreSQL');
  const [env, setEnv] = useState<'development' | 'staging' | 'production'>('development');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);
  const [connectionType, setConnectionType] = useState('Manual connection');
  const [connectionOptions, setConnectionOptions] = useState<{key: string, value: string}[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [dynamicParams, setDynamicParams] = useState(false);
  const [sslCert, setSslCert] = useState('None');

  const handleAddOption = () => {
      setConnectionOptions([...connectionOptions, { key: '', value: '' }]);
  };

  const handleRemoveOption = (index: number) => {
      setConnectionOptions(connectionOptions.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: 'key' | 'value', val: string) => {
      const newOptions = [...connectionOptions];
      newOptions[index][field] = val;
      setConnectionOptions(newOptions);
  };

  return (
    <div className="flex flex-col h-full bg-background w-full max-w-3xl mx-auto border-x border-border shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${activeProjectId}/datasources`)}>
                    <ArrowLeft size={18} />
                </Button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center border border-blue-100 dark:border-blue-900/50">
                        <PostgresIcon />
                    </div>
                    <div>
                        <Input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="h-8 font-semibold text-lg border-transparent bg-transparent hover:bg-muted/50 px-2 -ml-2 w-auto min-w-[150px]" 
                        />
                    </div>
                </div>
            </div>
            
            {/* Environment Tabs */}
            <div className="flex bg-muted/50 p-1 rounded-lg">
                {(['development', 'staging', 'production'] as const).map((e) => (
                    <button
                        key={e}
                        onClick={() => setEnv(e)}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all",
                            env === e 
                                ? "bg-background text-foreground shadow-sm" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                    >
                        {e}
                        {e !== 'development' && (
                            <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1 rounded">PRO</span>
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
            
            {/* Dynamic Params Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border">
                <div className="space-y-0.5">
                    <label className="text-sm font-medium text-foreground">Allow dynamic connection parameters</label>
                    <p className="text-xs text-muted-foreground">Override connection details at runtime</p>
                </div>
                <Switch checked={dynamicParams} onCheckedChange={setDynamicParams} />
            </div>

            {/* Connection Type */}
            <div className="space-y-2">
                <Label>Connection type</Label>
                <div className="relative">
                    <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none text-foreground"
                        value={connectionType}
                        onChange={(e) => setConnectionType(e.target.value)}
                    >
                        <option>Manual connection</option>
                        <option>Connection String</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 pointer-events-none" />
                </div>
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                    <Label>Host <span className="text-destructive">*</span></Label>
                    <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
                </div>
                <div className="col-span-1 space-y-2">
                    <Label>Port <span className="text-destructive">*</span></Label>
                    <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="5432" />
                </div>
            </div>

            {/* SSL Toggle */}
            <div className="flex items-center justify-between">
                <Label>SSL</Label>
                <Switch checked={ssl} onCheckedChange={setSsl} />
            </div>

            {/* Database Name */}
            <div className="space-y-2">
                <Label>Database name</Label>
                <Input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="postgres" />
            </div>

            {/* Auth */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Username <span className="text-destructive">*</span></Label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="postgres" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Password <span className="text-destructive">*</span></Label>
                        {isEditMode && (
                            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded border border-green-200 dark:border-green-900/50">
                                <Check size={12} /> Encrypted
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <Input 
                            type={showPassword ? "text" : "password"} 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder={isEditMode ? "**************" : "Enter password"}
                            className={cn("pr-10", isEditMode && "placeholder:text-foreground")}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Connection Options */}
            <div className="space-y-3">
                <Label>Connection options</Label>
                {connectionOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                        <Input 
                            value={opt.key} 
                            onChange={(e) => handleOptionChange(idx, 'key', e.target.value)} 
                            placeholder="Key" 
                            className="flex-1"
                        />
                        <Input 
                            value={opt.value} 
                            onChange={(e) => handleOptionChange(idx, 'value', e.target.value)} 
                            placeholder="Value" 
                            className="flex-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(idx)}>
                            <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                        </Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={handleAddOption} className="gap-2 text-xs h-8">
                    <Plus size={12} /> Add Option
                </Button>
            </div>

            {/* SSL Cert */}
            <div className="space-y-2">
                <Label>SSL certificate</Label>
                <div className="relative">
                    <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none text-foreground"
                        value={sslCert}
                        onChange={(e) => setSslCert(e.target.value)}
                    >
                        <option>None</option>
                        <option>CA Certificate</option>
                        <option>Self-signed</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 pointer-events-none" />
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded text-blue-700 dark:text-blue-300">
                    <Info size={14} />
                    Please white-list our IP address if the data source is not publicly accessible
                </div>
                <Button variant="ghost" size="sm" className="gap-2 h-8 text-xs">
                    <Copy size={12} /> Copy IP
                </Button>
            </div>
            
            <div className="flex gap-3">
                <Button variant="outline" className="gap-2">
                    <RefreshCw size={14} /> Test connection
                </Button>
                <Button>Save</Button>
            </div>
        </div>
    </div>
  );
};

export default PostgreSQLPage;
